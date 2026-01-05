import {
  AbstractNode,
  Document,
  Section,
  Block,
  List,
  ListItem,
  Converter,
  Asciidoctor as AsciidoctorType,
} from 'asciidoctor';
import {
  closeDb,
  initDb,
  insertNode,
  insertNodeId,
  insertVariant,
} from './db-utils';
import { Database } from 'better-sqlite3';
import fs from 'fs';
import { parseAsciiDocFile } from './asciidoctor-utils';
import { Variant } from './model';
import { getVersion } from './version-utils';

/**
 * Custom Converter to transform AsciiDoc AST into SQL Insert statements.
 */
export class SqlConverter implements Converter {
  private variantId: string;
  private workId: string;
  private out: string[];
  private nodeIdCounter: number;
  public db: Database;
  private parentRowIdStack: number[];

  constructor(variantPath: string) {
    this.out = [];
    this.nodeIdCounter = 1;
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
      title: decodeEntities(doc.getTitle() as string) as string,
      workId: this.workId,
      language: doc.getAttribute('lang') as string,
      version: getVersion(this.workId, this.variantId),
    };

    insertVariant(variant, this.db);

    closeDb(this.db);
  }

  private convertSection(section: Section) {
    const rowId = insertNode(
      {
        name: section.getNodeName(),
        parentRowId: this.parentRowIdStack[this.parentRowIdStack.length - 1],
        attributes: {
          title: decodeEntities(section.getTitle() as string) as string,
        },
      },
      this.db,
    );

    this.insertNodeId(section, rowId);

    this.parentRowIdStack.push(rowId);
    section.getContent();
    this.parentRowIdStack.pop();
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
          decodeEntities(
            block.applySubstitutions(block.getSource(), ['attributes']),
          ),
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
              decodeEntities(
                item.applySubstitutions(item.getText(), ['attributes']),
              ),
            ),
        ),
      },
      this.db,
    );

    this.insertNodeId(list, rowId);
  }

  private convertBlock(block: Block) {
    const title = decodeEntities(block.getTitle() as string) as string;
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

  private convertPreamble(preamble: Block) {
    const rowId = insertNode(
      {
        name: preamble.getNodeName(),
        parentRowId: this.parentRowIdStack[this.parentRowIdStack.length - 1],
        attributes: {
          title: preamble.getTitle(),
        },
      },
      this.db,
    );

    this.insertNodeId(preamble, rowId);

    this.parentRowIdStack.push(rowId);
    preamble.getContent();
    this.parentRowIdStack.pop();
  }

  private insertNodeId(node: AbstractNode, rowId: number) {
    if (node.getId() != null) {
      insertNodeId(node.getId(), rowId, this.db);
    }
  }
}

function decodeEntities(str: string | string[]): string | string[] {
  if (Array.isArray(str)) {
    return str.map((s) => decodeEntities(s) as string);
  }

  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#46;/g, '.') // Dot
    .replace(/&#8217;/g, '’') // Smart quote
    .replace(/&#8230;/g, '…') // Ellipsis
    .replace(/&#8203;/g, '') // Zero width space
    .replace(/&#8220;/g, '“') // Left double quote
    .replace(/&#8221;/g, '”') // Right double quote
    .replace(/<[^>]*>?/gm, ''); // OPTIONAL: Strip HTML tags (like <em>, <b>) if you want PURE text
}
