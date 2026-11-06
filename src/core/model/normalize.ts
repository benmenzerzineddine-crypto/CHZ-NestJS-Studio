import pluralize from "pluralize";
import type { EntityDef, RelationDef, RelationKind } from "./schema";

export interface DerivedInverse {
  sourceEntityId: string;
  relationId: string;
  targetEntityId: string;
  name: string;
  kind: RelationKind;
}

const INVERSE_KIND: Record<RelationKind, RelationKind> = {
  "many-to-one": "one-to-many",
  "one-to-many": "many-to-one",
  "one-to-one": "one-to-one",
  "many-to-many": "many-to-many",
};

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function upperFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function inverseKindOf(kind: RelationKind): RelationKind {
  return INVERSE_KIND[kind];
}

/**
 * Candidate names for the derived inverse, in preference order. The base name is
 * idiomatic (`posts` on User for `Post.author`), the fallback disambiguates with
 * the relation name when several relations target the same entity.
 */
export function inverseNameCandidates(
  source: EntityDef,
  relation: RelationDef,
): string[] {
  const base =
    relation.kind === "many-to-one" || relation.kind === "many-to-many"
      ? pluralize(lowerFirst(source.name))
      : lowerFirst(source.name);

  return [base, `${base}As${upperFirst(relation.name)}`];
}

/**
 * Derives the inverse side of every stored relation. Inverses are never stored,
 * so both sides cannot disagree. Names are made unique against the target
 * entity's fields and relations.
 */
export function buildDerivedInverses(entities: EntityDef[]): DerivedInverse[] {
  const used = new Map<string, Set<string>>();
  for (const entity of entities) {
    used.set(
      entity.id,
      new Set([
        ...entity.fields.map((field) => field.name),
        ...entity.relations.map((relation) => relation.name),
      ]),
    );
  }

  const inverses: DerivedInverse[] = [];

  for (const entity of entities) {
    for (const relation of entity.relations) {
      const target = entities.find((candidate) => candidate.id === relation.targetEntityId);
      if (!target) continue;

      const taken = used.get(target.id);
      if (!taken) continue;

      const candidates = inverseNameCandidates(entity, relation);
      let name = candidates.find((candidate) => !taken.has(candidate));

      if (!name) {
        const base = candidates[candidates.length - 1] ?? "inverse";
        let index = 2;
        while (taken.has(`${base}${index}`)) index += 1;
        name = `${base}${index}`;
      }

      taken.add(name);
      inverses.push({
        sourceEntityId: entity.id,
        relationId: relation.id,
        targetEntityId: target.id,
        name,
        kind: inverseKindOf(relation.kind),
      });
    }
  }

  return inverses;
}

export function derivedInversesFor(
  entities: EntityDef[],
  entityId: string,
): DerivedInverse[] {
  return buildDerivedInverses(entities).filter((inverse) => inverse.targetEntityId === entityId);
}
