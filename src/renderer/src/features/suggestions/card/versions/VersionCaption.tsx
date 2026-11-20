import type { ReactNode } from 'react';
import type { Proposal, ProposalVersion } from '@/types/agentProposal';
import { readNewestVersion, readVersionNumber } from '../../proposals/proposalVersions';
import { Caption, CaptionNote, CaptionTag } from '../bodies/BodyParts';

interface VersionCaptionProps {
  proposal: Proposal;
  /** The version the card shows. */
  version: ProposalVersion;
  /**
   * The caption a card with one version shows, such as "Suggested". When it is left out, a
   * card with one version shows no caption.
   */
  label?: ReactNode;
  /** More tags after the caption, such as "in your words". */
  children?: ReactNode;
}

/**
 * The caption over what a suggestion writes. On a card with several versions it names the
 * version shown, "Version 3", and says when it is the newest or the kept one.
 */
export function VersionCaption({ proposal, version, label, children }: VersionCaptionProps) {
  if (proposal.versions.length < 2) {
    if (label === undefined) return null;
    return (
      <Caption>
        {label}
        {children}
      </Caption>
    );
  }
  const isNewest = readNewestVersion(proposal).id === version.id;
  const isKept = proposal.status === 'accepted' && proposal.keptVersionId === version.id;
  return (
    <Caption>
      Version {readVersionNumber(proposal, version.id)}
      {isNewest && <CaptionNote>newest</CaptionNote>}
      {isKept && <CaptionTag>kept</CaptionTag>}
      {children}
    </Caption>
  );
}
