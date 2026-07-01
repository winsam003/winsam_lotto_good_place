export type BoardKind = "post" | "notice";

export interface BoardEntry {
  id: string;
  kind: BoardKind;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export const isBoardKind = (value: string): value is BoardKind =>
  value === "post" || value === "notice";

export const getBoardKindLabel = (kind: BoardKind) =>
  kind === "notice" ? "공지" : "자유글";
