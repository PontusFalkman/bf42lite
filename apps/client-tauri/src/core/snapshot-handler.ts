// apps/client-tauri/src/core/snapshot-handler.ts
import { handleSnapshot, SnapshotMessage } from '../systems/handleSnapshot';
import type { FlagSnapshot } from '@bf42lite/protocol';
import type { Renderer } from './Renderer';
import type { NetworkManager } from '../managers/NetworkManager';
import type { UIManager } from '../managers/UIManager';

export interface SnapshotResult {
  flags: FlagSnapshot[];
}

export function processSnapshot(
  msg: SnapshotMessage,
  world: any,
  renderer: Renderer,
  net: NetworkManager,
  ui: UIManager
): SnapshotResult {
  handleSnapshot(msg, world, renderer, net, ui);

  return {
    flags: (msg.flags ?? []) as FlagSnapshot[],
  };
}
