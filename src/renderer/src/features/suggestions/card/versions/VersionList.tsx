import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Proposal, ProposalVersion } from '@/types/agentProposal';
import { keepProposalVersion } from '../../proposals/proposalActions';
import { readNewestVersion, readVersionNumber } from '../../proposals/proposalVersions';
import { canKeepVersion } from '../../proposals/reviewedChange';
import { summarizeVersion } from './versionWords';

/*
 * The list of a suggestion's versions, newest first. It is closed until the user opens it,
 * and then shows one line: "3 versions · version 2 kept". Each row shows the version's
 * number, whether it is the newest or the kept one, the text it writes, and the assistant's
 * reason. It has two links: Show displays that version on the card, and Use this one keeps
 * it.
 */

interface VersionListProps {
  proposal: Proposal;
  /** The version the card shows. */
  shown: ProposalVersion;
  onShow: (versionId: string) => void;
}

export function VersionList({ proposal, shown, onShow }: VersionListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { versions } = proposal;
  if (versions.length < 2 || proposal.isStale) return null;
  const keptId = proposal.status === 'accepted' ? proposal.keptVersionId : null;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <div className="mb-1">
      <AppButton
        variant="quiet"
        size="xs"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="-ml-1.5"
      >
        <Chevron className="size-2.75" />
        {isOpen ? 'Hide the versions' : `${versions.length} versions`}
        {!isOpen && keptId && (
          <span className="text-ink-faint">
            · version {readVersionNumber(proposal, keptId)} kept
          </span>
        )}
      </AppButton>
      {isOpen && (
        <div className="mt-1.5 mb-1.5 flex flex-col overflow-hidden rounded-sm border border-line bg-pane-raised [&>*+*]:border-t [&>*+*]:border-line">
          {versions.toReversed().map((version) => (
            <VersionRow
              key={version.id}
              proposal={proposal}
              version={version}
              isShown={version.id === shown.id}
              isKept={version.id === keptId}
              onShow={() => onShow(version.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface VersionRowProps {
  proposal: Proposal;
  version: ProposalVersion;
  isShown: boolean;
  isKept: boolean;
  onShow: () => void;
}

/** One version in the list. The row of the version the card shows is green, with a bar on its left. */
function VersionRow({ proposal, version, isShown, isKept, onShow }: VersionRowProps) {
  const isNewest = readNewestVersion(proposal).id === version.id;
  const canKeep = canKeepVersion(proposal, version);
  const useThisOne = () => {
    if (keepProposalVersion(proposal.id, version.id)) onShow();
  };
  return (
    <div
      className={cn(
        'flex flex-col gap-0.75 px-2.5 pt-1.75 pb-2',
        isShown && 'bg-add-soft shadow-[inset_2px_0_0_var(--add)]'
      )}
    >
      <div className="flex items-center gap-2">
        <Text variant="strong" className="whitespace-nowrap">
          Version {readVersionNumber(proposal, version.id)}
        </Text>
        <Text variant="secondary" className="min-w-0 flex-1 truncate text-ink-muted">
          {version.reason}
        </Text>
        {(isKept || isNewest) && (
          <Text variant="secondary" className={isKept ? 'text-add' : 'text-amber'}>
            {isKept ? 'kept' : 'newest'}
          </Text>
        )}
      </div>
      <Text as="p" variant="secondary" className="text-pretty">
        {summarizeVersion(version)}
      </Text>
      {(!isShown || !isKept) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {!isShown && (
            <AppButton variant="link" size="xs" shape="text" onClick={onShow} className="p-0">
              Show
            </AppButton>
          )}
          {!isKept && (
            <AppButton
              variant="link"
              size="xs"
              shape="text"
              disabled={!canKeep}
              title={canKeep ? undefined : 'Confirm its facts first'}
              onClick={useThisOne}
              className="p-0"
            >
              Use this one
            </AppButton>
          )}
        </div>
      )}
    </div>
  );
}
