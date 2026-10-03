import { useEffect, useRef, useState } from 'react';
import { attempt, showToast } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { VersionMeta } from '@shared/types/db';
import { versionLabel } from '../useTemplateVersions';
import type { VersionRowMode } from './VersionRow';

/** How long a row just named keeps its wash: the animation's 1.6s, and a little to spare. */
const JUST_NAMED_MS = 1800;

/**
 * Naming and deleting from a history list: which row is open for either, the row just
 * named, and the writes. One row is open at a time. Naming gives no toast, since the row
 * itself turns bold; a delete offers Undo.
 */
export function useVersionEdits() {
  const renameVersion = useTemplateStore((s) => s.renameVersion);
  const removeVersion = useTemplateStore((s) => s.removeVersion);
  const putBackVersion = useTemplateStore((s) => s.putBackVersion);
  const [openRow, setOpenRow] = useState<{ versionId: string; mode: VersionRowMode } | null>(null);
  const [justNamedId, setJustNamedId] = useState<string | null>(null);
  const washTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(washTimer.current), []);

  const modeOf = (version: VersionMeta) =>
    openRow?.versionId === version.id ? openRow.mode : null;

  const setMode = (version: VersionMeta, mode: VersionRowMode | null) =>
    setOpenRow(mode ? { versionId: version.id, mode } : null);

  const name = async (version: VersionMeta, newName: string) => {
    setOpenRow(null);
    if (version.kind === 'named' && newName === version.summary) return;
    if (!(await attempt(renameVersion(version.id, newName), 'Could not name that version'))) {
      return;
    }
    if (version.kind === 'auto') {
      clearTimeout(washTimer.current);
      setJustNamedId(version.id);
      washTimer.current = setTimeout(() => setJustNamedId(null), JUST_NAMED_MS);
    }
  };

  const remove = async (version: VersionMeta) => {
    setOpenRow(null);
    if (!(await attempt(removeVersion(version), 'Could not delete that version'))) return;
    showToast(
      version.kind === 'named'
        ? `Deleted “${version.summary}”`
        : `Deleted automatic snapshot ${versionLabel(version)}`,
      'success',
      {
        label: 'Undo',
        run: () => void attempt(putBackVersion(version.id), 'Could not put that version back'),
      }
    );
  };

  return {
    modeOf,
    setMode,
    justNamedId,
    name: (version: VersionMeta, newName: string) => void name(version, newName),
    remove: (version: VersionMeta) => void remove(version),
  };
}
