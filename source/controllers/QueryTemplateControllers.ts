import joi from "joi";

import type { Query, ExternalQuery, QueryPage } from "../types";

import { constants, BadRequestError, NotFoundError } from "../utils";
import { QueryTemplateModel } from "../models";

const filterSchema = joi.object({
    page: joi.number().integer().default(0),
    limit: joi
        .number()
        .integer()
        .min(constants.paginateMinLimit)
        .max(constants.paginateMaxLimit)
        .default(constants.paginateMinLimit),
});

const toExternal = (query: Query): ExternalQuery => {
    const {
        id,
        name,
        description,
        resource,
        app,
        content,
        status,
        lifecycle,
        createdAt,
        updatedAt,
    } = query;

    return {
        id,
        name,
        description,
        resource,
        app,
        content,
        status,
        lifecycle,
        createdAt,
        updatedAt,
    };
};

const listByIds = async (context, ids: string[]): Promise<ExternalQuery[]> => {
    const unorderedQueries = await QueryTemplateModel.find({
        _id: { $in: ids },
        status: { $ne: "deleted" },
    }).exec();
    const object = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const query of unorderedQueries) {
        object[query._id] = query;
    }
    // eslint-disable-next-line security/detect-object-injection
    return ids.map((key) => toExternal(object[key]));
};

const listByAppIds = async (
    context,
    appIds: string[]
): Promise<ExternalQuery[]> => {
    const unorderedQueries = await QueryTemplateModel.find({
        app: { $in: appIds },
        status: { $ne: "deleted" },
    }).exec();
    const object = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const query of unorderedQueries) {
        object[query._id] = query;
    }
    // eslint-disable-next-line security/detect-object-injection
    return appIds.map((key) => toExternal(object[key]));
};

const getById = async (context, id: string): Promise<ExternalQuery> => {
    if (!constants.identifierPattern.test(id)) {
        throw new BadRequestError("The specified query identifier is invalid.");
    }

    // TODO: Update filters
    const filters = {
        _id: id,
        status: { $ne: "deleted" },
    };
    const query = await QueryTemplateModel.findOne(filters as any).exec();

    /* We return a 404 error, if we did not find the query. */
    if (!query) {
        throw new NotFoundError(
            "Cannot find a query with the specified identifier."
        );
    }

    return toExternal(query);
};

const remove = async (context, id: string): Promise<{ success: boolean }> => {
    if (!constants.identifierPattern.test(id)) {
        throw new BadRequestError("The specified query identifier is invalid.");
    }

    // TODO: Update filters
    const query = await QueryTemplateModel.findOneAndUpdate(
        {
            _id: id,
            status: { $ne: "deleted" },
        },
        {
            status: "deleted",
        },
        {
            new: true,
            lean: true,
        }
    );

    if (!query) {
        throw new NotFoundError(
            "A query with the specified identifier does not exist."
        );
    }

    return { success: true };
};

const removeAllStatic = async (context): Promise<{ success: boolean }> => {
    // TODO: Update filters
    const query = await QueryTemplateModel.updateMany(
        {
            lifecycle: "static",
            status: { $ne: "deleted" },
        },
        {
            status: "deleted",
        },
        {
            new: true,
            lean: true,
        }
    );

    if (!query) {
        throw new NotFoundError("Cannot find any static queries.");
    }

    return { success: true };
};

export { listByIds, listByAppIds, getById, remove, removeAllStatic };
