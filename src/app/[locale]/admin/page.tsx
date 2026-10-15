"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Закон");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");

  if (status === "loading") return <div className="p-8 text-white">Загрузка...</div>;
  if (!session || session.user?.email !== "alemy112233@gmail.com") {
    return <div className="p-8 text-red-500 font-bold">Доступ запрещен</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusText("");

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("category", category);
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("text", text);
      }

      const res = await fetch("/api/admin/add-doc", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setStatusText(`Успешно! Добавлено фрагментов: ${data.count}`);
        setTitle("");
        setText("");
        setFile(null);
      } else {
        setStatusText(`Ошибка: ${data.error}`);
      }
    } catch (err) {
      setStatusText("Произошла ошибка при отправке");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 mt-10 bg-zinc-900 text-white rounded-xl border border-zinc-800">
      <h1 className="text-xl font-bold mb-4">Панель администратора</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1 text-zinc-400">Название</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-zinc-400">Категория</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white"
          >
            <option value="Закон">Закон</option>
            <option value="Кодекс">Кодекс</option>
            <option value="Иное">Иное</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1 text-zinc-400">PDF файл</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white"
          />
        </div>
        {!file && (
          <div>
            <label className="block text-sm mb-1 text-zinc-400">Или текст</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white font-mono text-sm"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 rounded disabled:opacity-50"
        >
          {loading ? "Загрузка..." : "Отправить"}
        </button>
        {statusText && <div className="p-3 bg-zinc-800 rounded text-sm">{statusText}</div>}
      </form>
    </div>
  );
}