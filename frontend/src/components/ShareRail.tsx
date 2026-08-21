import { useEffect, useState } from "react";
import type { ShareItem } from "../lib/portfolio";

export function ShareRail({ items }: { items: ShareItem[] }) {
  const [perPage, setPerPage] = useState(2);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, pages - 1);
  const visible = items.slice(safePage * perPage, safePage * perPage + perPage);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const sync = () => {
      setPerPage(mq.matches ? 1 : 2);
      setPage(0);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  function next() {
    setPage((current) => (current + 1) % pages);
  }

  function prev() {
    setPage((current) => (current - 1 + pages) % pages);
  }

  return (
    <div className="share-rail">
      <div className="share-stage">
        <button type="button" className="share-arrow is-prev" onClick={prev} aria-label="Previous videos">
          ‹
        </button>
        <div className="share-pair">
          {visible.map((item) => (
            <a className="share-card" href={item.href} target="_blank" rel="noreferrer" key={item.href}>
              <span className="share-thumb">
                <img src={item.thumb} alt="" />
                <span className="share-play" aria-hidden />
              </span>
              <span className="share-card-title">{item.title}</span>
            </a>
          ))}
        </div>
        <button type="button" className="share-arrow is-next" onClick={next} aria-label="Next videos">
          ›
        </button>
      </div>
    </div>
  );
}
