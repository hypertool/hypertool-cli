import type { ApolloClient } from "@apollo/client";

import { gql, ApolloError } from "@apollo/client";
import lodash from "lodash";

import type { Manifest, App, Query as QueryTemplate, Resource } from "../types";

const GET_APP_BY_NAME = gql`
    query GetAppByName($name: String!) {
        getAppByName(name: $name) {
            id
            name
            title
            slug
            description
            groups
            resources
            status
            createdAt
            updatedAt
        }
    }
`;

const CREATE_APP = gql`
    mutation CreateApp(
        $name: String!
        $title: String!
        $slug: String!
        $description: String
        $groups: [ID!]
    ) {
        createApp(
            name: $name
            title: $title
            slug: $slug
            description: $description
            groups: $groups
        ) {
            id
        }
    }
`;

const UPDATE_APP = gql`
    mutation UpdateApp(
        $appId: ID!
        $name: String
        $title: String
        $slug: String
        $description: String
        $groups: [ID!]
    ) {
        updateApp(
            appId: $appId
            name: $name
            title: $title
            slug: $slug
            description: $description
            groups: $groups
        ) {
            id
        }
    }
`;

const GET_QUERY_TEMPLATE_BY_NAME = gql`
    query GetQueryTemplateByName($name: String!) {
        getQueryTemplateByName(name: $name) {
            id
            name
        }
    }
`;

const CREATE_QUERY_TEMPLATE = gql`
    mutation CreateQueryTemplate(
        $name: String!
        $description: String
        $resource: ID!
        $app: ID!
        $content: String!
    ) {
        createQueryTemplate(
            name: $name
            description: $description
            resource: $resource
            app: $app
            content: $content
        ) {
            id
        }
    }
`;

const UPDATE_QUERY_TEMPLATE = gql`
    mutation UpdateQueryTemplate(
        $queryTemplateId: ID!
        $name: String
        $description: String
        $content: String
    ) {
        updateQueryTemplate(
            queryTemplateId: $queryTemplateId
            name: $name
            description: $description
            content: $content
        ) {
            id
        }
    }
`;

const CREATE_RESOURCE = gql`
    mutation CreateResource(
        $name: String!
        $description: String
        $type: ResourceType!
        $mysql: MySQLConfigurationInput
        $postgres: PostgresConfigurationInput
        $mongodb: MongoDBConfigurationInput
        $bigquery: BigQueryConfigurationInput
    ) {
        createResource(
            name: $name
            description: $description
            type: $type
            mysql: $mysql
            postgres: $postgres
            mongodb: $mongodb
            bigquery: $bigquery
        ) {
            id
        }
    }
`;

const isNotFoundError = (error0: unknown): boolean => {
    if (error0 instanceof ApolloError) {
        const error = error0 as ApolloError;
        if (
            error.graphQLErrors.length > 0 &&
            error.graphQLErrors[0].extensions.code === "NOT_FOUND_ERROR"
        ) {
            return true;
        }
    }
    return false;
};

export default class Client<T> {
    client: ApolloClient<T>;

    constructor(client: ApolloClient<T>) {
        this.client = client;
    }

    async getAppByName(name: string): Promise<App | null> {
        try {
            const app = await this.client.query({
                query: GET_APP_BY_NAME,
                variables: {
                    name: name,
                },
            });
            return app.data.getAppByName;
        } catch (error: unknown) {
            if (isNotFoundError(error)) {
                return null;
            }
            throw error;
        }
    }

    convertNameToId(name: string, type: string) {
        return "507f1f77bcf86cd799439011";
    }

    async createApp(app: App): Promise<void> {
        await this.client.mutate({
            mutation: CREATE_APP,
            variables: {
                name: app.name,
                title: app.title,
                slug: app.slug,
                description: app.description,
                groups: app.groups.map((group) =>
                    this.convertNameToId(group, "group"),
                ),
            },
        });
    }

    async updateApp(appId: string, app: App): Promise<void> {
        await this.client.mutate({
            mutation: UPDATE_APP,
            variables: {
                appId,
                name: app.name,
                title: app.title,
                slug: app.slug,
                description: app.description,
                /* Any implicit value injection to the manifests must be done
                 * during compilation by the compiler, not when syncing changes.
                 */
                groups: app.groups.map((group) =>
                    this.convertNameToId(group, "group"),
                ),
            },
        });
    }

    async getQueryTemplateByName(name: string): Promise<QueryTemplate | null> {
        try {
            const queryTemplate = await this.client.query({
                query: GET_QUERY_TEMPLATE_BY_NAME,
                variables: {
                    name: name,
                },
            });
            return queryTemplate.data.getQueryTemplateByName;
        } catch (error: unknown) {
            if (isNotFoundError(error)) {
                return null;
            }
            throw error;
        }
    }

    async createQueryTemplate(
        queryTemplate: QueryTemplate,
        appName: string,
    ): Promise<void> {
        await this.client.mutate({
            mutation: CREATE_QUERY_TEMPLATE,
            variables: {
                name: queryTemplate.name,
                description: queryTemplate.description,
                resource: this.convertNameToId(
                    queryTemplate.resource,
                    "resource",
                ),
                app: this.convertNameToId(appName, "app"),
                content: queryTemplate.content,
            },
        });
    }

    async updateQueryTemplate(
        queryTemplateId: string,
        queryTemplate: QueryTemplate,
    ): Promise<void> {
        await this.client.mutate({
            mutation: UPDATE_QUERY_TEMPLATE,
            variables: {
                queryTemplateId,
                name: queryTemplate.name,
                description: queryTemplate.description,
                content: queryTemplate.content,
            },
        });
    }

    async createResource(resource: Resource, appName: string): Promise<void> {
        await this.client.mutate({
            mutation: CREATE_RESOURCE,
            variables: {
                name: resource.name,
                description: resource.description,
                type: resource.type,
                [resource.type]: resource.connection,
            },
        });
    }

    async patchApp(oldApp: App, newApp: App): Promise<boolean> {
        const keys = ["name", "slug", "description", "title", "groups"];
        const oldAppPicked = lodash.pick(oldApp, keys);
        const newAppPicked = lodash.pick(newApp, keys);

        if (!oldAppPicked || !newAppPicked) {
            throw new Error("lodash.pick() returned undefined for some reason");
        }

        /* `oldAppPicked.groups` contains IDs, not names. Therefore, convert
         * names in `newAppPicked.groups` to their corresponding IDs before
         * comparing.
         */
        newAppPicked.groups = newAppPicked?.groups?.map((group) =>
            this.convertNameToId(group, "group"),
        );

        if (lodash.isEqual(oldAppPicked, newAppPicked)) {
            return false;
        }

        await this.updateApp(oldApp.id as string, newApp);

        return true;
    }

    async patchQueryTemplate(
        oldQueryTemplate: QueryTemplate,
        newQueryTemplate: QueryTemplate,
    ): Promise<boolean> {
        const keys = ["name", "description", "content"];
        const oldQueryTemplatePicked = lodash.pick(oldQueryTemplate, keys);
        const newQueryTemplatePicked = lodash.pick(newQueryTemplate, keys);

        if (!oldQueryTemplatePicked || !newQueryTemplatePicked) {
            throw new Error("lodash.pick() returned undefined for some reason");
        }

        if (lodash.isEqual(oldQueryTemplatePicked, newQueryTemplatePicked)) {
            return false;
        }

        await this.updateQueryTemplate(
            oldQueryTemplate.id as string,
            newQueryTemplate,
        );
        return true;
    }

    async syncManifest(manifest: Manifest) {
        const { app, queries, resources } = manifest;

        const deployedApp = await this.getAppByName(app.name);
        if (!deployedApp) {
            await this.createApp(app);
        } else {
            await this.patchApp(deployedApp, app);
        }

        /* TODO: Fetch all the queries at once and then run the patching algorithm. */
        for (const queryTemplate of queries) {
            const deployedQueryTemplate = await this.getQueryTemplateByName(
                queryTemplate.name,
            );
            if (!deployedQueryTemplate) {
                await this.createQueryTemplate(queryTemplate, app.name);
            } else {
                await this.patchQueryTemplate(
                    deployedQueryTemplate,
                    queryTemplate,
                );
            }
        }

        for (const resource of resources) {
            await this.createResource(resource, app.name);
        }
    }
}
