export interface IController {
  id: string;
  name: string;
  description: string;
  language: string;
  patched: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IScreen {
  id: string;
  app: IApp;
  name: string;
  title: string;
  description: string;
  slug: string;
  content: string;
  controller: IController;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApp {
  id: string;
  name: string;
  title: string;
  slug: string;
  description: string;
  screens: IScreen[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TAppContext = IApp;

export interface ICraftNode {
  custom: {
    [key: string]: any;
  };
  nodes: string[];
  props: {
    [key: string]: any;
  };
  type: {
    resolvedName: string;
  };
  parent?: string;
}

export type TCraftNodeKey = keyof ICraftNode;

export type TBasicNodeType = "View" | "Fragment" | "Text";

export type TPropertyValue = number | boolean | string | null | object;

export interface INode {
  id: string;
  type: string | TBasicNodeType;
  children: INode[];
  props: Record<string, TPropertyValue>;
}

export interface IPatch {
  [key: string]: Record<string, TPropertyValue> | INode;
}

export interface IHyperContext<S> {
  refs: Record<string, any>;

  setState: {
    (state: Partial<S>): void;
    (name: string, value: S[keyof S]): void;
  };

  getState: {
    (): S;
    (name: string): S[keyof S];
  };

  inflate: (
    name: string,
    patches?: Record<string, IPatch>
  ) => INode;
}

export interface IHyperController<T> {
  init?: (context: IHyperContext<T>) => void;
  render?: (context: IHyperContext<T>) => INode;
}
