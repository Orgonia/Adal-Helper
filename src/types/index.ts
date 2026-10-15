export interface SourceDoc {
  /** Имя файла, используется как идентификатор */
  _id: string;
  title: string;
  topic: string;
  lang: string;
  /** Хэш содержимого + метаданных (для пропуска неизменённых файлов) */
  hash: string;
  chunkCount: number;
  updatedAt: Date;
}

export interface ChunkDoc {
  source: string;
  title: string;
  topic: string;
  lang: string;
  /** Ближайший заголовок (статья, глава и т.п.) */
  heading: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  createdAt: Date;
}

export interface RetrievedChunk {
  text: string;
  title: string;
  source: string;
  topic: string;
  heading: string;
  chunkIndex: number;
  score: number;
}
