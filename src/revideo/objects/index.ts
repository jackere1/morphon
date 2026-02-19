import type {View2D} from '@revideo/2d';
import type {Reference} from '@revideo/core';
import type {Node} from '@revideo/2d';
import type {SceneObject, ManifestMeta} from '../types';
import {buildGraph, type GraphRefs} from './graph-builder';
import {buildDataStructure, type DataStructureRefs} from './data-structure-builder';
import {buildText, type TextRefs} from './text-builder';

export type ObjectRefs = GraphRefs | DataStructureRefs | TextRefs;

export interface SceneObjectEntry {
  obj: SceneObject;
  refs: ObjectRefs;
}

export function createSceneObjects(
  view: View2D,
  objects: SceneObject[],
  meta: ManifestMeta,
): Map<string, SceneObjectEntry> {
  const entries = new Map<string, SceneObjectEntry>();

  for (const obj of objects) {
    let result: {node: JSX.Element; refs: ObjectRefs};

    switch (obj.type) {
      case 'graph':
        result = buildGraph(obj as any, meta);
        break;
      case 'data-structure':
        result = buildDataStructure(obj as any, meta);
        break;
      case 'text':
        result = buildText(obj as any, meta);
        break;
      default:
        console.warn(`Unknown object type: ${(obj as any).type}`);
        continue;
    }

    view.add(result.node);
    entries.set(obj.id, {obj, refs: result.refs});
  }

  return entries;
}

export {type GraphRefs} from './graph-builder';
export {type DataStructureRefs} from './data-structure-builder';
export {type TextRefs} from './text-builder';
