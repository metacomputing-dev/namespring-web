import fs from 'node:fs';
import path from 'node:path';

import { isPanelAuthorityScope } from './authority-evidence.mjs';
import {
  canonicalPolicyValue,
  digestFile,
  nonEmptyString,
  pathIsWithin,
} from './policy-core.mjs';

const APPROVED_PANEL_MODEL_IDENTITIES = new Set([
  'anthropic/claude/5',
  'openai/gpt/5',
]);

export function canonicalPanelModelIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'family,provider,version') return '';
  const provider = canonicalPolicyValue(value.provider);
  const family = canonicalPolicyValue(value.family);
  const version = canonicalPolicyValue(value.version);
  if (!provider || !family || !version) return '';
  return provider + '/' + family + '/' + version;
}

export function canonicalPanelModelSet(models) {
  return [...new Set(
    (Array.isArray(models) ? models : [])
      .map(canonicalPanelModelIdentity)
      .filter(Boolean),
  )].sort();
}

export function hasExactPanelModelListShape(models) {
  if (!Array.isArray(models)) return false;
  const identities = models.map(canonicalPanelModelIdentity);
  return identities.every(Boolean) &&
    new Set(identities).size === identities.length;
}

export function isApprovedPanelModelIdentity(identity) {
  return APPROVED_PANEL_MODEL_IDENTITIES.has(identity);
}

export function canonicalPanelScopeSet(scopes) {
  return [...new Set(
    (Array.isArray(scopes) ? scopes : [])
      .filter((scope) => typeof scope === 'string' && isPanelAuthorityScope(scope)),
  )].sort();
}

export function hasExactPanelScopeListShape(scopes) {
  return Array.isArray(scopes) &&
    scopes.length > 0 &&
    scopes.every((scope) =>
      typeof scope === 'string' && isPanelAuthorityScope(scope)) &&
    new Set(scopes).size === scopes.length;
}

function directoryContainsEvidenceFile(dirPath) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isFile() && entry.name !== 'panel-manifest.json') return true;
    if (entry.isDirectory() && directoryContainsEvidenceFile(entryPath)) return true;
  }
  return false;
}

function validatePanelEvidenceFiles(dossierReal, row, modelIds, panelScopes, binding, add) {
  if (!Array.isArray(row.evidence) || row.evidence.length < 2) {
    add('insufficient_panel_evidence_files', 'panel manifest requires at least two model-bound evidence files');
    return;
  }
  const evidenceModels = [];
  const evidenceRealPaths = [];
  const evidenceDigests = [];
  for (const evidence of row.evidence) {
    const modelId = canonicalPanelModelIdentity(evidence?.model);
    if (!modelId || !isApprovedPanelModelIdentity(modelId)) {
      add('unapproved_panel_evidence_model', 'panel evidence model is not in the reviewed model catalog');
      continue;
    }
    evidenceModels.push(modelId);

    const relativePath = evidence?.path;
    if (
      typeof relativePath !== 'string' ||
      relativePath.trim().length === 0 ||
      path.isAbsolute(relativePath)
    ) {
      add('invalid_panel_evidence_path', 'panel evidence paths must be non-empty and dossier-relative');
      continue;
    }
    const evidencePath = path.resolve(dossierReal, relativePath);
    if (
      !pathIsWithin(dossierReal, evidencePath) ||
      path.relative(dossierReal, evidencePath) === '' ||
      !fs.existsSync(evidencePath) ||
      !fs.statSync(evidencePath).isFile()
    ) {
      add('invalid_panel_evidence_path', 'panel evidence file must exist inside the validated dossier');
      continue;
    }
    const evidenceReal = fs.realpathSync(evidencePath);
    if (!pathIsWithin(dossierReal, evidenceReal)) {
      add('invalid_panel_evidence_path', 'panel evidence file escapes the validated dossier');
      continue;
    }
    evidenceRealPaths.push(evidenceReal);
    const stat = fs.statSync(evidenceReal);
    if (!Number.isInteger(evidence.bytes) || evidence.bytes < 64 || evidence.bytes !== stat.size) {
      add('invalid_panel_evidence_size', 'panel evidence bytes must match a non-trivial file of at least 64 bytes');
    }
    if (
      typeof evidence.fileDigest !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(evidence.fileDigest) ||
      evidence.fileDigest !== digestFile(evidenceReal)
    ) {
      add('panel_evidence_digest_mismatch', 'panel evidence digest must match the committed evidence file');
    } else {
      evidenceDigests.push(evidence.fileDigest);
    }

    let evidenceDocument;
    try {
      evidenceDocument = JSON.parse(fs.readFileSync(evidenceReal, 'utf8'));
    } catch (error) {
      add('invalid_panel_evidence_document', 'panel evidence must be valid JSON: ' + error.message);
      continue;
    }
    if (evidenceDocument?.schemaVersion !== 'spring-ts.panel-evidence.v1') {
      add('invalid_panel_evidence_schema', 'panel evidence schemaVersion must be spring-ts.panel-evidence.v1');
    }
    if (
      evidenceDocument?.recordId !== binding.recordId ||
      evidenceDocument?.recordDigest !== binding.contentDigest
    ) {
      add('panel_evidence_record_mismatch', 'panel evidence must bind the same authority record and digest');
    }
    if (canonicalPanelModelIdentity(evidenceDocument?.model) !== modelId) {
      add('panel_evidence_identity_mismatch', 'panel evidence document model must match its manifest row');
    }
    const evidenceScopes = canonicalPanelScopeSet(evidenceDocument?.scopes);
    if (
      !hasExactPanelScopeListShape(evidenceDocument?.scopes) ||
      evidenceDocument.scopes.length !== panelScopes.length ||
      evidenceScopes.length !== panelScopes.length ||
      evidenceScopes.some((scope, index) => scope !== panelScopes[index])
    ) {
      add('panel_evidence_scopes_mismatch', 'panel evidence scopes must match panelAdjudication.scopes');
    }
    if (evidenceDocument?.verdict !== 'approved') {
      add('panel_evidence_verdict_not_approved', 'panel evidence verdict must be approved');
    }
    if (
      !evidenceDocument?.output ||
      typeof evidenceDocument.output !== 'object' ||
      !nonEmptyString(evidenceDocument.output.reasoning) ||
      evidenceDocument.output.reasoning.trim().length < 32
    ) {
      add('insufficient_panel_evidence_output', 'panel evidence output requires at least 32 characters of reasoning');
    }
  }
  const uniqueModels = [...new Set(evidenceModels)].sort();
  const uniquePaths = new Set(evidenceRealPaths);
  if (
    uniqueModels.length !== modelIds.length ||
    uniqueModels.some((model, index) => model !== modelIds[index])
  ) {
    add('panel_evidence_models_mismatch', 'evidence files must cover every adjudicating model exactly');
  }
  if (uniquePaths.size !== evidenceRealPaths.length) {
    add('duplicate_panel_evidence_path', 'each adjudicating model requires a distinct evidence file');
  }
  if (new Set(evidenceDigests).size !== evidenceDigests.length) {
    add('duplicate_panel_evidence_digest', 'independent model evidence files must have distinct content digests');
  }
}

function validatePanelManifest(dossierReal, binding, modelIds, panelScopes, sourceTier, add) {
  const manifestPath = path.join(dossierReal, 'panel-manifest.json');
  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
    add('missing_panel_manifest', 'panel dossier must contain panel-manifest.json');
    return;
  }
  let manifestReal;
  try {
    manifestReal = fs.realpathSync(manifestPath);
  } catch (error) {
    add('invalid_panel_manifest_path', 'panel manifest cannot be resolved: ' + error.message);
    return;
  }
  if (!pathIsWithin(dossierReal, manifestReal)) {
    add('invalid_panel_manifest_path', 'panel manifest escapes the validated dossier directory');
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestReal, 'utf8'));
  } catch (error) {
    add('invalid_panel_manifest', 'panel manifest must be valid JSON: ' + error.message);
    return;
  }
  if (manifest?.schemaVersion !== 'spring-ts.panel-adjudication.v1') {
    add('invalid_panel_manifest_schema', 'panel manifest schemaVersion must be spring-ts.panel-adjudication.v1');
  }
  if (!Array.isArray(manifest?.records) || !binding.recordId) {
    add('invalid_panel_manifest_records', 'panel manifest must contain a records array bound to the authority record');
    return;
  }
  const rows = manifest.records.filter((row) => row?.recordId === binding.recordId);
  if (rows.length !== 1) {
    add('panel_manifest_record_mismatch', 'panel manifest must contain exactly one row for the authority record');
    return;
  }
  const row = rows[0];
  if (!binding.contentDigest || row.contentDigest !== binding.contentDigest) {
    add('panel_manifest_digest_mismatch', 'panel manifest digest must match the canonical authority record');
  }
  if (row.verdict !== 'approved') {
    add('panel_manifest_verdict_not_approved', 'panel manifest verdict must be approved');
  }
  if (row.adversarialVerification !== true) {
    add('panel_manifest_adversarial_missing', 'panel manifest must attest adversarialVerification=true');
  }
  if (
    row.reviewedBy !== sourceTier.authorityReview?.reviewedBy ||
    row.reviewedAt !== sourceTier.authorityReview?.reviewedAt
  ) {
    add('panel_manifest_reviewer_mismatch', 'panel manifest reviewer must match sourceTier.authorityReview');
  }
  const manifestModels = canonicalPanelModelSet(row.models);
  if (
    !hasExactPanelModelListShape(row.models) ||
    row.models.length !== modelIds.length ||
    manifestModels.length !== modelIds.length ||
    manifestModels.some((model, index) => model !== modelIds[index])
  ) {
    add('panel_manifest_models_mismatch', 'panel manifest models must match panelAdjudication.models');
  }
  const manifestScopes = canonicalPanelScopeSet(row.scopes);
  if (
    !hasExactPanelScopeListShape(row.scopes) ||
    row.scopes.length !== panelScopes.length ||
    manifestScopes.length !== panelScopes.length ||
    manifestScopes.some((scope, index) => scope !== panelScopes[index])
  ) {
    add('panel_manifest_scopes_mismatch', 'panel manifest scopes must match panelAdjudication.scopes');
  }
  validatePanelEvidenceFiles(dossierReal, row, modelIds, panelScopes, binding, add);
}

export function validatePanelDossierEvidence({
  dossier,
  root,
  binding,
  modelIds,
  panelScopes,
  sourceTier,
  sourceTierPath,
  add,
}) {
  if (typeof dossier !== 'string' || dossier.trim().length === 0) {
    add(
      'missing_panel_dossier',
      sourceTierPath + '.panelAdjudication.dossier is required',
    );
    return;
  }
  if (!root) {
    add(
      'missing_panel_validation_root',
      'panel dossier validation requires an explicit repository root',
    );
    return;
  }

  const rootPath = path.resolve(root);
  const dossierInput = dossier.trim();
  const dossierPath = path.resolve(rootPath, dossierInput);
  const dossierRoot = path.resolve(rootPath, 'docs/dossiers');
  if (
    path.isAbsolute(dossierInput) ||
    !pathIsWithin(rootPath, dossierPath) ||
    !pathIsWithin(dossierRoot, dossierPath) ||
    path.relative(dossierRoot, dossierPath) === ''
  ) {
    add(
      'invalid_panel_dossier_path',
      sourceTierPath + '.panelAdjudication.dossier must be a repository-relative docs/dossiers directory',
    );
    return;
  }
  if (!fs.existsSync(dossierPath) || !fs.statSync(dossierPath).isDirectory()) {
    add(
      'missing_panel_dossier_path',
      sourceTierPath + '.panelAdjudication.dossier must resolve to an existing directory',
    );
    return;
  }

  try {
    const rootReal = fs.realpathSync(rootPath);
    const dossierRootReal = fs.realpathSync(dossierRoot);
    const dossierReal = fs.realpathSync(dossierPath);
    if (
      !pathIsWithin(rootReal, dossierReal) ||
      !pathIsWithin(dossierRootReal, dossierReal)
    ) {
      add(
        'invalid_panel_dossier_path',
        sourceTierPath + '.panelAdjudication.dossier escapes the repository dossier root',
      );
    } else if (!directoryContainsEvidenceFile(dossierReal)) {
      add(
        'empty_panel_dossier',
        sourceTierPath + '.panelAdjudication.dossier must contain evidence beyond its manifest',
      );
    } else {
      validatePanelManifest(dossierReal, binding, modelIds, panelScopes, sourceTier, add);
    }
  } catch (error) {
    add(
      'invalid_panel_dossier_path',
      sourceTierPath + '.panelAdjudication.dossier cannot be resolved: ' + error.message,
    );
  }
}
