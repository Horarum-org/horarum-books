import { AbstractNode, Document, Block, List, Converter } from 'asciidoctor';
import {
  closeDb,
  initDb,
  insertNode,
  insertNodeId,
  insertVariant,
} from './db-utils';
import { Database } from 'better-sqlite3';
import fs from 'fs';
import { Variant } from './model';
import { getVersion } from './version-utils';

/**
 * Custom Converter to transform AsciiDoc AST into SQL Insert statements.
 */
export class SqlConverter implements Converter {
  private variantId: string;
  private workId: string;
  public db: Database;
  private parentRowIdStack: number[];

  constructor(variantPath: string) {
    this.parentRowIdStack = [];

    const [workid, variantId] = variantPath.split('/');
    this.workId = workid;
    this.variantId = variantId;

    fs.mkdirSync(`dist/${variantId}`, { recursive: true });

    this.db = initDb(`dist/${variantId}/${variantId}`);
  }

  /**
   * The main entry point. Asciidoctor calls this for every node in the tree.
   */
  convert(node: AbstractNode): string {
    const nodeName = node.getNodeName();

    // We handle specific nodes, or fallback to a generic handler
    switch (nodeName) {
      case 'document':
        this.convertDocument(node as Document);
        break;
      case 'verse':
      case 'paragraph':
        this.convertParagraph(node as Block);
        break;
      case 'ulist':
      case 'olist':
        this.convertList(node as List);
        break;
      case 'section':
      case 'preamble':
      case 'open':
      case 'quote':
        this.convertBlock(node as Block);
        break;
      case 'inline_anchor':
      case 'inline_quoted':
        // Ignore these nodes
        break;
      default:
        console.log(`unknown: ${nodeName}`);
        break;
    }

    return '';
  }

  private convertDocument(doc: Document) {
    // Generate SQL for the root document
    const rowId = insertNode(
      {
        name: doc.getNodeName(),
        attributes: {
          title: doc.getTitle(),
          language: doc.getAttribute('lang') as string,
        },
      },
      this.db,
    );

    this.insertNodeId(doc, rowId);

    this.parentRowIdStack.push(rowId);
    doc.getContent();
    this.parentRowIdStack.pop();

    const variant: Variant = {
      id: this.variantId,
      title: doc.getTitle() as string,
      workId: this.workId,
      language: doc.getAttribute('lang') as string,
      version: getVersion(this.workId, this.variantId),
    };

    insertVariant(variant, this.db);

    closeDb(this.db);
  }

  private convertParagraph(block: Block) {
    const rowId = insertNode(
      {
        name: block.getNodeName(),
        parentRowId: this.parentRowIdStack[this.parentRowIdStack.length - 1],
        attributes: {
          title: block.getTitle(),
        },
        content: JSON.stringify(
          block.applySubstitutions(block.getSource(), ['attributes']),
        ),
      },
      this.db,
    );

    this.insertNodeId(block, rowId);

    this.parentRowIdStack.push(rowId);
    block.getContent();
    this.parentRowIdStack.pop();
  }

  private convertList(list: List) {
    const rowId = insertNode(
      {
        name: list.getNodeName(),
        parentRowId: this.parentRowIdStack[this.parentRowIdStack.length - 1],
        attributes: {
          title: list.getTitle(),
        },
        content: JSON.stringify(
          list
            .getItems()
            .map((item) =>
              item.applySubstitutions(item.getText(), ['attributes']),
            ),
        ),
      },
      this.db,
    );

    this.insertNodeId(list, rowId);
  }

  private convertBlock(block: Block) {
    const title = block.getTitle() as string;
    const rowId = insertNode(
      {
        name: block.getNodeName(),
        parentRowId: this.parentRowIdStack[this.parentRowIdStack.length - 1],
        attributes: {
          title: title === '' ? undefined : title,
        },
      },
      this.db,
    );

    this.insertNodeId(block, rowId);

    this.parentRowIdStack.push(rowId);
    block.getContent();
    this.parentRowIdStack.pop();
  }

  private insertNodeId(node: AbstractNode, rowId: number) {
    if (node.getId() != null) {
      insertNodeId(node.getId(), rowId, this.db);
    }
  }
}
