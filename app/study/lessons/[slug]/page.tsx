import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Nav } from '../../../components/Nav';
import { LESSON_BY_SLUG, LESSONS, TOPIC_META_BY_SLUG } from '../../lessons-content';
import type { LessonBlock } from '../../lesson-types';

// Prerender every lesson page at build time.
export function generateStaticParams() {
  return LESSONS.map(l => ({ slug: l.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  // params is a Promise in Next 16; static-only path so we resolve inside.
  return params.then(({ slug }) => {
    const meta = TOPIC_META_BY_SLUG[slug];
    return { title: meta ? `${meta.title} — SF Prep` : 'Lesson — SF Prep' };
  });
}

// Sibling lesson lookup for prev/next links inside the same section.
function siblings(slug: string) {
  const meta = TOPIC_META_BY_SLUG[slug];
  if (!meta) return { prev: null, next: null };
  const section = LESSONS
    .filter(l => l.meta.section === meta.section)
    .sort((a, b) => a.meta.order - b.meta.order);
  const idx = section.findIndex(l => l.slug === slug);
  return {
    prev: idx > 0 ? section[idx - 1].meta : null,
    next: idx < section.length - 1 ? section[idx + 1].meta : null,
  };
}

const SECTION_LABEL: Record<string, string> = {
  ar: 'Arithmetic Reasoning',
  wk: 'Word Knowledge',
  pc: 'Paragraph Comprehension',
  'test-day': 'Test-Day Strategy',
};

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = LESSON_BY_SLUG[slug];
  if (!lesson) notFound();

  const { prev, next } = siblings(slug);
  // Only AR lessons have a drill; other sections are strategy-only.
  const drillable = lesson.meta.section === 'ar';

  return (
    <div className="lesson-shell">
      <Nav />
      <style>{`
        .lesson-shell { background: var(--lesson-ground); color: var(--lesson-ink); min-height: 100vh; }
        :root {
          --lesson-ground: #F2F1EC; --lesson-surface: #EBEAE4;
          --lesson-ink: #1A1D22; --lesson-ink-soft: #3B3E43;
          --lesson-muted: #7A7D82; --lesson-rule: #D8D6D0; --lesson-rule-strong: #B8B6B0;
          --lesson-accent: #B85C38;
          --lesson-highlight-bg: #F0E4C2; --lesson-highlight-border: #C9A94A;
          --lesson-bad: #9B4A47; --lesson-bad-bg: #E8D1CE;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --lesson-ground: #131518; --lesson-surface: #1A1D22;
            --lesson-ink: #E9E7E1; --lesson-ink-soft: #C4C2BC;
            --lesson-muted: #8B8E93; --lesson-rule: #2A2D32; --lesson-rule-strong: #40434A;
            --lesson-accent: #E17A50;
            --lesson-highlight-bg: #3A3220; --lesson-highlight-border: #8F7A38;
            --lesson-bad: #C97671; --lesson-bad-bg: #2F1F1E;
          }
        }
        :root[data-theme="light"] {
          --lesson-ground: #F2F1EC; --lesson-surface: #EBEAE4;
          --lesson-ink: #1A1D22; --lesson-ink-soft: #3B3E43;
          --lesson-muted: #7A7D82; --lesson-rule: #D8D6D0; --lesson-rule-strong: #B8B6B0;
          --lesson-accent: #B85C38;
          --lesson-highlight-bg: #F0E4C2; --lesson-highlight-border: #C9A94A;
          --lesson-bad: #9B4A47; --lesson-bad-bg: #E8D1CE;
        }
        :root[data-theme="dark"] {
          --lesson-ground: #131518; --lesson-surface: #1A1D22;
          --lesson-ink: #E9E7E1; --lesson-ink-soft: #C4C2BC;
          --lesson-muted: #8B8E93; --lesson-rule: #2A2D32; --lesson-rule-strong: #40434A;
          --lesson-accent: #E17A50;
          --lesson-highlight-bg: #3A3220; --lesson-highlight-border: #8F7A38;
          --lesson-bad: #C97671; --lesson-bad-bg: #2F1F1E;
        }

        .lesson-page {
          max-width: 720px; margin: 0 auto; padding: 32px 24px 96px;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          font-size: 14px; line-height: 1.5; color: var(--lesson-ink);
        }
        .lesson-crumbs {
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--lesson-muted); margin-bottom: 24px;
        }
        .lesson-crumbs a { color: var(--lesson-muted); text-decoration: none; }
        .lesson-crumbs a:hover { color: var(--lesson-accent); }
        .lesson-crumbs .sep { color: var(--lesson-rule-strong); margin: 0 6px; }

        .lesson-h1 {
          font-family: Georgia, "Charter", "Iowan Old Style", "Times New Roman", serif;
          font-size: 34px; font-weight: 400; margin: 0 0 8px;
          letter-spacing: -0.01em; text-wrap: balance; line-height: 1.15;
        }
        .lesson-sub {
          font-family: Georgia, serif;
          font-size: 17px; color: var(--lesson-ink-soft); margin: 0 0 24px;
          font-style: italic; max-width: 60ch;
        }
        .lesson-meta-bar {
          display: flex; gap: 20px; font-size: 12px; color: var(--lesson-muted);
          padding-bottom: 20px; border-bottom: 1px solid var(--lesson-rule);
          margin-bottom: 32px; flex-wrap: wrap;
        }
        .lesson-meta-bar .divider { color: var(--lesson-rule-strong); }
        .lesson-meta-bar strong { color: var(--lesson-ink); font-weight: 500; }

        .lesson-body {
          font-family: Georgia, "Charter", serif;
          font-size: 17px; line-height: 1.65; color: var(--lesson-ink-soft);
        }
        .lesson-body p { margin: 0 0 16px; }
        .lesson-body strong { color: var(--lesson-ink); font-weight: 600; }
        .lesson-body em { color: var(--lesson-accent); font-style: normal; font-weight: 500; }
        .lesson-body .mono {
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 0.92em; background: var(--lesson-surface); padding: 1px 5px;
          border-radius: 2px; color: var(--lesson-ink);
        }
        .lesson-body h3 {
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--lesson-muted); font-weight: 500;
          margin: 36px 0 12px; padding-top: 12px; border-top: 1px solid var(--lesson-rule);
        }
        .lesson-body h3:first-child { margin-top: 0; padding-top: 0; border-top: 0; }

        .lesson-body ul { padding-left: 20px; margin: 12px 0 20px; }
        .lesson-body ul li { margin-bottom: 8px; }
        .lesson-body ol { padding-left: 24px; margin: 12px 0 20px; }

        .callout {
          background: var(--lesson-highlight-bg);
          border-left: 3px solid var(--lesson-highlight-border);
          padding: 16px 20px; margin: 22px 0;
        }
        .callout .tag {
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--lesson-accent); font-weight: 600; margin-bottom: 10px;
        }
        .callout .prompt { font-size: 15px; color: var(--lesson-ink); margin-bottom: 8px; }
        .callout .answer {
          font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--lesson-accent); margin-top: 10px; font-family: ui-sans-serif, sans-serif;
        }
        .callout .answer strong { font-family: Georgia, serif; text-transform: none; letter-spacing: 0; color: var(--lesson-ink); font-size: 15px; font-weight: 600; margin-left: 8px; }
        .callout.trap { background: var(--lesson-bad-bg); border-left-color: var(--lesson-bad); }
        .callout.trap .tag { color: var(--lesson-bad); }
        .callout.trap .body { font-size: 15px; color: var(--lesson-ink); line-height: 1.55; }

        .callout.note {
          background: transparent; border-left: 3px solid var(--lesson-rule-strong);
          font-size: 14px; color: var(--lesson-ink-soft);
        }
        .callout.note .tag { color: var(--lesson-muted); }

        .steps {
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-variant-numeric: tabular-nums;
          font-size: 13.5px; line-height: 1.9; margin: 8px 0 4px 0;
          color: var(--lesson-ink);
        }
        .steps .row { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
        .steps .lbl { color: var(--lesson-muted); min-width: 14ch; }
        .steps .val { color: var(--lesson-ink); }
        .steps .val strong { color: var(--lesson-accent); font-weight: 600; }
        .steps .comment { color: var(--lesson-muted); font-family: Georgia, serif; font-size: 13px; font-style: italic; margin-left: 4px; }

        .drill-cta {
          margin-top: 48px; padding-top: 28px; border-top: 1px solid var(--lesson-rule);
          display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
        }
        .btn {
          font: inherit; font-size: 13px; padding: 11px 22px; border-radius: 2px;
          border: 1px solid var(--lesson-ink); background: var(--lesson-ink); color: var(--lesson-ground);
          cursor: pointer; text-decoration: none; display: inline-block;
        }
        .btn.accent { background: var(--lesson-accent); border-color: var(--lesson-accent); color: #fff; }
        .btn.ghost { background: transparent; color: var(--lesson-ink); }
        .btn-hint { font-size: 12px; color: var(--lesson-muted); }

        .siblings {
          margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--lesson-rule);
          display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
        }
        .siblings a { color: var(--lesson-ink); text-decoration: none; font-family: Georgia, serif; }
        .siblings a:hover .siblings-title { color: var(--lesson-accent); }
        .siblings .side { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--lesson-muted); font-family: ui-sans-serif, sans-serif; margin-bottom: 6px; display: block; }
        .siblings .siblings-title { font-size: 16px; }
        .siblings .next-col { text-align: right; }
        .siblings .empty { color: var(--lesson-rule-strong); font-family: Georgia, serif; font-style: italic; }

        @media (max-width: 640px) {
          .lesson-h1 { font-size: 27px; }
          .lesson-sub { font-size: 15px; }
          .lesson-body { font-size: 16px; }
          .siblings { grid-template-columns: 1fr; }
          .siblings .next-col { text-align: left; }
        }
      `}</style>

      <div className="lesson-page">
        <nav className="lesson-crumbs">
          <Link href="/study">Study</Link>
          <span className="sep">·</span>
          <span>{SECTION_LABEL[lesson.meta.section]}</span>
          <span className="sep">·</span>
          <span>Lesson {lesson.meta.order} of {LESSONS.filter(l => l.meta.section === lesson.meta.section).length}</span>
        </nav>

        <h1 className="lesson-h1">{lesson.meta.title}</h1>
        <p className="lesson-sub">{lesson.meta.subtitle}</p>

        <div className="lesson-meta-bar">
          <span><strong>~{lesson.meta.minutes} min</strong> read</span>
          {lesson.meta.petersonRef && <>
            <span className="divider">·</span>
            <span>Peterson&apos;s <strong>{lesson.meta.petersonRef}</strong></span>
          </>}
          {drillable && <>
            <span className="divider">·</span>
            <span>Then drill against a <strong>3:42 CAT</strong> or <strong>72s MET</strong> benchmark</span>
          </>}
        </div>

        <div className="lesson-body">
          {lesson.blocks.map((block, i) => <BlockView key={i} block={block} />)}
        </div>

        {drillable && (
          <div className="drill-cta">
            <Link className="btn accent" href={`/study?drill=${lesson.slug}`}>
              Drill {lesson.meta.title.split('—')[0].trim()} now →
            </Link>
            <Link className="btn ghost" href="/study">Back to curriculum</Link>
            <span className="btn-hint">10 questions from this topic</span>
          </div>
        )}

        <div className="siblings">
          <div>
            {prev ? (
              <Link href={`/study/lessons/${prev.slug}`}>
                <span className="side">← Previous</span>
                <span className="siblings-title">{prev.title}</span>
              </Link>
            ) : (
              <><span className="side">Previous</span><span className="empty">— start of section —</span></>
            )}
          </div>
          <div className="next-col">
            {next ? (
              <Link href={`/study/lessons/${next.slug}`}>
                <span className="side">Next →</span>
                <span className="siblings-title">{next.title}</span>
              </Link>
            ) : (
              <><span className="side">Next</span><span className="empty">— end of section —</span></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Renders a single lesson block based on its `kind` discriminator.
function BlockView({ block }: { block: LessonBlock }) {
  switch (block.kind) {
    case 'p':
      return <p dangerouslySetInnerHTML={{ __html: block.text }} />;
    case 'h':
      return <h3>{block.text}</h3>;
    case 'list':
      return block.ordered
        ? <ol>{block.items.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: it }} />)}</ol>
        : <ul>{block.items.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: it }} />)}</ul>;
    case 'example':
      return (
        <div className="callout">
          <div className="tag">Worked example</div>
          <div className="prompt" dangerouslySetInnerHTML={{ __html: block.prompt }} />
          <div className="steps">
            {block.steps.map((s, i) => (
              <div key={i} className="row">
                <span className="lbl">{s.label}</span>
                <span className="val" dangerouslySetInnerHTML={{ __html: s.value }} />
                {s.comment && <span className="comment">{s.comment}</span>}
              </div>
            ))}
          </div>
          <div className="answer">Answer <strong dangerouslySetInnerHTML={{ __html: block.answer }} /></div>
        </div>
      );
    case 'trap':
      return (
        <div className="callout trap">
          <div className="tag">{block.title ?? 'The trap the ASVAB uses here'}</div>
          <div className="body" dangerouslySetInnerHTML={{ __html: block.text }} />
        </div>
      );
    case 'note':
      return (
        <div className="callout note">
          <div className="tag">Note</div>
          <div dangerouslySetInnerHTML={{ __html: block.text }} />
        </div>
      );
  }
}
