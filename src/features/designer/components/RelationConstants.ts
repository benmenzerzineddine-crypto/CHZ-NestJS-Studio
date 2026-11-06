import type { RelationKind } from "@/core/model/schema";

export const RELATION_LABELS: Record<RelationKind, string> = {
  "many-to-one": "many-to-one",
  "one-to-many": "one-to-many",
  "one-to-one": "one-to-one",
  "many-to-many": "many-to-many",
};

export const CREATABLE_KINDS: RelationKind[] = [
  "many-to-one",
  "one-to-many",
  "one-to-one",
  "many-to-many",
];
