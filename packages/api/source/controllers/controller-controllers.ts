import {
    IController,
    IControllerPatch,
    IExternalController,
    InternalServerError,
    TControllerPage,
    runAsTransaction,
} from "@hypertool/common";
import {
    AppModel,
    BadRequestError,
    ControllerModel,
    NotFoundError,
    constants,
} from "@hypertool/common";

import { applyPatch, createTwoFilesPatch } from "diff";
import joi from "joi";
import { Types } from "mongoose";

import { checkPermissions } from "../utils";

const createSchema = joi.object({
    name: joi.string().regex(constants.namePattern).required(),
    description: joi.string().max(512).allow("").default(""),
    language: joi
        .string()
        .valid(...constants.controllerLanguages)
        .required(),
    patches: joi.array().items(
        joi.object({
            author: joi.string().regex(constants.identifierPattern),
            content: joi.string().allow(""),
        }),
    ),
    app: joi.string().regex(constants.identifierPattern).required(),
});

const filterSchema = joi.object({
    app: joi.string().regex(constants.identifierPattern).required(),
    page: joi.number().integer().default(0),
    limit: joi
        .number()
        .integer()
        .min(constants.paginateMinLimit)
        .max(constants.paginateMaxLimit)
        .default(constants.paginateMinLimit),
});

// TODO: Allow description to be updated
const updateSchema = joi.object({
    patches: joi.array().items(
        joi.object({
            author: joi.string().regex(constants.identifierPattern),
            content: joi.string().allow(""),
        }),
    ),
});

// TODO: Allow description to be updated
const updateWithSourceSchema = joi.object({
    source: joi.string().allow(""),
});

const patchAll = (patches: IControllerPatch[]) =>
    patches.reduce(
        (previousValue: string, currentValue: { content: string }) => {
            const patched = applyPatch(previousValue, currentValue.content);
            if (!patched) {
                throw new Error(
                    "Failed to apply patch: " + currentValue.content,
                );
            }
            return patched;
        },
        "",
    );

const toExternal = (controller: IController): IExternalController => {
    const {
        _id,
        name,
        description,
        language,
        creator,
        patches,
        status,
        createdAt,
        updatedAt,
    } = controller;

    /*
     * NOTE: At the moment, all the controllers provide unpopulated fields.
     * Therefore, we consider all the IDs to be of type ObjectId.
     */
    return {
        id: _id.toString(),
        name,
        description,
        language,
        creator: creator.toString(),
        patches: patches.map((patch) => {
            const { author, content, createdAt } = patch;
            return {
                author: author.toString(),
                content,
                createdAt,
            };
        }),
        patched: patchAll(patches),
        status,
        createdAt,
        updatedAt,
    };
};

export const create = async (
    context: any,
    attributes: any,
): Promise<IExternalController> => {
    const { error, value } = createSchema.validate(attributes, {
        stripUnknown: true,
    });
    if (error) {
        throw new BadRequestError(error.message);
    }

    const newController = await runAsTransaction(async () => {
        const newControllerId = new Types.ObjectId();
        const app = await AppModel.findOneAndUpdate(
            {
                _id: value.app,
                status: { $ne: "deleted" },
            },
            {
                $push: {
                    controllers: newControllerId,
                },
            },
            {
                lean: true,
                new: true,
            },
        );

        if (!app) {
            throw new NotFoundError(
                "Cannot find an app with the specified identifier.",
            );
        }

        /*
         * At this point, the app has been modified, regardless of the currently
         * logged in user being authorized or not. When we check for permissions
         * below, we rely on the transaction failing to undo the changes.
         */
        checkPermissions(context.user, "appBuilder.controllers.create", [app]);

        const existingController = await ControllerModel.findOne({
            name: value.name,
            app: value.app,
            status: { $ne: "deleted" },
        });
        if (existingController) {
            throw new BadRequestError(
                `Controller with name "${value.name}" already exists.`,
            );
        }

        const newController = new ControllerModel({
            ...value,
            status: "created",
            creator: context.user._id,
        });
        await newController.save();

        return newController;
    });

    return toExternal(newController);
};

export const list = async (
    context: any,
    parameters: any,
): Promise<TControllerPage> => {
    const { error, value } = filterSchema.validate(parameters);
    if (error) {
        throw new BadRequestError(error.message);
    }

    const { page, limit } = value;
    const app = await AppModel.findById(value.app);
    checkPermissions(context.user, "appBuilder.controllers.list", [app]);

    const queries = await (ControllerModel as any).paginate(
        {
            app,
            status: {
                $ne: "deleted",
            },
        },
        {
            limit,
            page: page + 1,
            lean: true,
            leanWithId: true,
            pagination: true,
            sort: {
                updatedAt: -1,
            },
        },
    );

    return {
        totalRecords: queries.totalDocs,
        totalPages: queries.totalPages,
        previousPage: queries.prevPage ? queries.prevPage - 1 : -1,
        nextPage: queries.nextPage ? queries.nextPage - 1 : -1,
        hasPreviousPage: queries.hasPrevPage,
        hasNextPage: queries.hasNextPage,
        records: queries.docs.map(toExternal),
    };
};

export const listByIds = async (
    context,
    ids: string[],
): Promise<IExternalController[]> => {
    const items = await ControllerModel.find({
        _id: { $in: ids },
        status: { $ne: "deleted" },
    }).exec();
    if (items.length !== ids.length) {
        throw new NotFoundError(
            `Could not find items for every specified ID. Request ${ids.length} items, but found ${items.length} items.`,
        );
    }

    checkPermissions(context.user, "appBuilder.controllers.listByIds", [items]);

    const object = {};
    for (const item of items) {
        object[item._id.toString()] = item;
    }

    return ids.map((key) => toExternal(object[key]));
};

export const getById = async (
    context: any,
    id: string,
): Promise<IExternalController> => {
    if (!constants.identifierPattern.test(id)) {
        throw new BadRequestError("The specified identifier is invalid.");
    }

    const controller = await ControllerModel.findOne({
        _id: id,
        status: { $ne: "deleted" },
    }).exec();
    checkPermissions(context.user, "appBuilder.controllers.view", [controller]);

    /* We return a 404 error, if we did not find the entity. */
    if (!controller) {
        throw new NotFoundError(
            "Could not find any screen with the specified identifier.",
        );
    }

    return toExternal(controller);
};

export const getByName = async (
    context: any,
    name: string,
): Promise<IExternalController> => {
    if (!constants.namePattern.test(name)) {
        throw new BadRequestError("The specified name is invalid.");
    }

    const controller = await ControllerModel.findOne({
        name,
        status: { $ne: "deleted" },
    }).exec();
    checkPermissions(context.user, "appBuilder.controllers.view", [controller]);

    /* We return a 404 error, if we did not find the entity. */
    if (!controller) {
        throw new NotFoundError(
            "Could not find any screen with the specified identifier.",
        );
    }

    return toExternal(controller);
};

export const update = async (context: any, id: string, attributes: any) => {
    const { error, value } = updateSchema.validate(attributes, {
        stripUnknown: true,
    });
    if (error) {
        throw new BadRequestError(error.message);
    }

    const updatedController = await runAsTransaction(async () => {
        const updatedController = await ControllerModel.findOneAndUpdate(
            {
                _id: id,
                status: { $ne: "deleted" },
            },
            value,
            { new: true, lean: true },
        ).exec();

        if (!updatedController) {
            throw new NotFoundError(
                "A controller with the specified identifier does not exist.",
            );
        }

        /*
         * At this point, the controller has been modified, regardless of the
         * currently logged in user being authorized or not. When we check for
         * permissions below, we rely on the transaction failing to undo the
         * changes.
         */
        checkPermissions(context.user, "appBuilder.controllers.update", [
            updatedController,
        ]);

        return updatedController;
    });

    return toExternal(updatedController);
};

export const updateWithSource = async (
    context: any,
    id: string,
    attributes: any,
): Promise<IExternalController> => {
    const { error, value } = updateWithSourceSchema.validate(attributes, {
        stripUnknown: true,
    });
    if (error) {
        throw new BadRequestError(error.message);
    }

    const controller = await ControllerModel.findOne({
        _id: id,
        status: { $ne: "delete" },
    }).exec();
    if (!controller) {
        throw new NotFoundError(
            `Could not find any controller with the specified identifier.`,
        );
    }

    checkPermissions(context.user, "appBuilder.controllers.update", [
        controller,
    ]);

    const oldSource = patchAll(controller.patches);
    const newPatch = createTwoFilesPatch(
        `a/${controller.name}`,
        `b/${controller.name}`,
        oldSource,
        value.source,
        "",
        "",
    );

    const updatedController = await ControllerModel.findByIdAndUpdate(
        id,
        {
            $push: {
                patches: {
                    author: context.user._id,
                    content: newPatch,
                },
            },
        },
        {
            new: true,
            lean: true,
        },
    ).exec();
    if (!updatedController) {
        throw new InternalServerError(
            "Failed to update and verify new controller state.",
        );
    }

    return toExternal(updatedController);
};

export const remove = async (context: any, id: string) => {
    if (!constants.identifierPattern.test(id)) {
        throw new BadRequestError(
            "The specified controller identifier is invalid.",
        );
    }

    await runAsTransaction(async () => {
        const controller = await ControllerModel.findOneAndUpdate(
            {
                _id: id,
                status: { $ne: "deleted" },
                creator: context.user._id,
            },
            {
                status: "deleted",
            },
            {
                new: true,
                lean: true,
            },
        );
        if (!controller) {
            throw new NotFoundError(
                "A controller with the specified identifier does not exist.",
            );
        }

        /*
         * At this point, the controller has been modified, regardless of the
         * currently logged in user being authorized or not. When we check for
         * permissions below, we rely on the transaction failing to undo the
         * changes.
         */
        checkPermissions(context.user, "appBuilder.controllers.delete", [
            controller,
        ]);
    });

    return { success: true };
};
