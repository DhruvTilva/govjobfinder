"use client";

import { useState } from "react";

/** Filters the exam directory rows (marked data-exam) and groups (data-exam-group) as you type. */
export function ExamFilter({ total }: { total: number }) {
  const [shown, setShown] = useState(total);
  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value.trim().toLowerCase();
    let n = 0;
    document.querySelectorAll<HTMLElement>("[data-exam-group]").forEach((g) => {
      let visible = 0;
      g.querySelectorAll<HTMLElement>("[data-exam]").forEach((row) => {
        const hit = !q || (row.dataset.exam ?? "").includes(q);
        row.hidden = !hit;
        if (hit) visible++;
      });
      g.hidden = visible === 0;
      n += visible;
    });
    setShown(n);
  }
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <label htmlFor="exam-filter" className="sr-only">
        Filter exams
      </label>
      <input id="exam-filter" type="search" onChange={onInput} placeholder="Filter by exam, post or recruiting body (e.g. constable, PCS, nurse)" className="input max-w-xl" />
      <span className="text-sm text-muted" aria-live="polite">
        {shown} of {total} exams
      </span>
    </div>
  );
}
