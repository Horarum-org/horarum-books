export interface NodeAttributes {
  title?: string;
  language?: string;
}

export interface Node {
  rowId?: number;
  name: string;
  parentRowId?: number;
  attributes?: NodeAttributes;
  content?: string;
}

export interface Work {
  id: string;
  title: string;
  variants: string[];
}

export interface Variant {
  rowId?: number;
  workId: string;
  id: string;
  title: string;
  language: string;
  version: string;
}
