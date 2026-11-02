import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignBadge, DesignButton, DesignCard, DesignDialog, DesignField } from './components';
import './gallery.css';

const sections = [ ['buttons', '버튼'], ['fields', '입력'], ['cards', '카드와 상태'], ['dialog', '대화상자'], ['colors', '색상'] ] as const;
type SectionId = typeof sections[number][0];
const palette = [
  { title: '표면', items: [['canvas', '화면 배경'], ['surface', '카드 표면'], ['surface-low', '보조 표면'], ['surface-container', '컨테이너 표면']] },
  { title: '텍스트', items: [['ink', '기본 글자'], ['muted', '보조 글자']] },
  { title: '주요 행동과 선택', items: [['primary', '강조 글자'], ['primary-fill', '주요 버튼 배경'], ['on-primary', '주요 버튼 글자'], ['primary-container', '선택 배경'], ['on-primary-container', '선택 글자']] },
  { title: '경계와 포커스', items: [['outline', '입력 경계'], ['outline-soft', '장식 구분선'], ['focus', '포커스 링']] },
  { title: '상태', items: [['success', '성공'], ['warning', '주의'], ['error', '오류']] },
] as const;

function formatHex(value: string) {
  const hex = value.trim();
  if (/^#[\da-f]{3}$/i.test(hex)) return '#' + [...hex.slice(1)].map(c => c + c).join('').toUpperCase();
  return hex ? hex.toUpperCase() : '—';
}

function Gallery() {
  const [dark, setDark] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [checked, setChecked] = useState(false);
  const [sampleAction, setSampleAction] = useState('');
  const [paletteAction, setPaletteAction] = useState('');
  const [cardAction, setCardAction] = useState('');
  const [active, setActive] = useState<SectionId>('buttons');
  const [colorValues, setColorValues] = useState<Record<string, string>>({});
  const galleryRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const navigationTarget = useRef<SectionId | null>(null);
  useEffect(() => {
    const update = () => {
      if (navigationTarget.current) { setActive(navigationTarget.current); return; }
      const threshold = window.innerWidth <= 960 ? 120 : 40;
      let current: SectionId = sections[0][0];
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        setActive(sections[sections.length - 1][0]);
        return;
      }
      for (const [id] of sections) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= threshold) current = id;
      }
      setActive(current);
    };
    const release = () => { navigationTarget.current = null; };
    const releaseForKey = (event: KeyboardEvent) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) release(); };
    const releaseForPointer = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest('.gallery-nav a')) release(); };
    const onHashChange = () => { navigationTarget.current = sections.find(([id]) => `#${id}` === window.location.hash)?.[0] ?? null; update(); };
    const initial = sections.find(([id]) => `#${id}` === window.location.hash);
    if (initial) navigationTarget.current = initial[0];
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchstart', release, { passive: true });
    window.addEventListener('keydown', releaseForKey);
    window.addEventListener('pointerdown', releaseForPointer);
    window.addEventListener('hashchange', onHashChange);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); window.removeEventListener('wheel', release); window.removeEventListener('touchstart', release); window.removeEventListener('keydown', releaseForKey); window.removeEventListener('pointerdown', releaseForPointer); window.removeEventListener('hashchange', onHashChange); };
  }, []);
  useLayoutEffect(() => {
    if (!galleryRef.current) return;
    const styles = getComputedStyle(galleryRef.current);
    const values: Record<string, string> = {};
    for (const group of palette) for (const [key] of group.items) values[key] = formatHex(styles.getPropertyValue(`--ds-${key}`));
    setColorValues(values);
  }, [dark]);
  return <div ref={galleryRef} className="gallery" data-ds-theme={dark ? 'dark' : 'light'}>
    <header className="gallery-header"><div><span className="gallery-mark" aria-hidden="true">P</span><strong>Pick Team</strong><span className="gallery-header-sub">디자인 시스템</span></div><DesignButton variant="outline" onClick={() => setDark(!dark)}>{dark ? '라이트 모드' : '다크 모드'}</DesignButton></header>
    <div className="gallery-workspace">
      <aside className="gallery-sidebar"><strong>디자인 시스템</strong><nav className="gallery-nav" aria-label="컴포넌트 목록">{sections.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined} onClick={() => { navigationTarget.current = id; setActive(id); }}>{label}</a>)}</nav></aside>
      <main className="gallery-main">
        <div className="gallery-intro"><h1>컴포넌트</h1></div>
        <section className="gallery-section" id="buttons"><h2>버튼</h2><div className="gallery-demo"><div className="gallery-row">
          <DesignButton onClick={() => setSampleAction('기본 버튼을 눌렀어요.')}>기본</DesignButton>
          <DesignButton variant="secondary" onClick={() => setSampleAction('보조 버튼을 눌렀어요.')}>보조</DesignButton>
          <DesignButton variant="outline" onClick={() => setSampleAction('테두리 버튼을 눌렀어요.')}>테두리</DesignButton>
          <DesignButton variant="ghost" onClick={() => setSampleAction('텍스트 버튼을 눌렀어요.')}>텍스트</DesignButton>
          <DesignButton variant="danger" onClick={() => setSampleAction('위험 버튼을 눌렀어요.')}>위험</DesignButton>
          <DesignButton disabled>비활성 예시</DesignButton>
        </div><p className="gallery-caption" role="status">{sampleAction}</p></div></section>
        <section className="gallery-section" id="fields"><h2>입력</h2><div className="gallery-demo gallery-fields">
          <DesignField ref={nameRef} label="팀 이름" value={name} onChange={event => setName(event.target.value)} placeholder="예: 프론트엔드 3팀" help={checked && name.trim() ? '팀 이름을 입력했어요.' : undefined} error={checked && !name.trim() ? '팀 이름을 입력해 주세요.' : undefined} />
          <DesignButton variant="secondary" onClick={() => { setChecked(true); if (!name.trim()) nameRef.current?.focus(); }}>입력 확인</DesignButton>
          <DesignField label="초대 코드" placeholder="초대 코드를 입력해 주세요" />
          <DesignField label="비활성 입력 예시" placeholder="입력할 수 없는 상태" disabled />
        </div></section>
        <section className="gallery-section" id="cards"><h2>카드와 상태</h2><div className="gallery-cards"><DesignCard title="아직 팀이 없어요"><p>팀을 만들거나 초대 링크로 참여해 보세요.</p><DesignButton variant="secondary" onClick={() => setCardAction('샘플 버튼을 눌렀어요.')}>팀 만들기</DesignButton><p role="status">{cardAction}</p></DesignCard><DesignCard title="팀 빌딩"><div className="gallery-row"><DesignBadge>모집 중</DesignBadge><DesignBadge tone="success">완료</DesignBadge><DesignBadge tone="warning">승인 대기</DesignBadge><DesignBadge tone="error">오류</DesignBadge></div></DesignCard></div></section>
        <section className="gallery-section" id="dialog"><h2>대화상자</h2><div className="gallery-demo"><DesignButton variant="outline" onClick={() => setDialogOpen(true)}>대화상자 열기</DesignButton><p className="gallery-caption">실제 초대는 변경되지 않아요.</p></div></section>
        <section className="gallery-section" id="colors"><h2>색상</h2>
          <div className="palette-brand"><span className="palette-brand-chip" aria-hidden="true" /><div><strong>브랜드 기준색</strong><span>#6667AB · 테마 공통</span></div></div>
          <div className="palette-examples">
            <section className="palette-example"><h3>표면과 글자</h3><div className="palette-surfaces">
              {([['canvas', '화면 배경'], ['surface', '카드 표면'], ['surface-low', '보조 표면'], ['surface-container', '컨테이너']] as const).map(([key, label]) => <div className="palette-surface" key={key} style={{backgroundColor:`var(--ds-${key})`}}><strong>{label}</strong><span>보조 글자</span></div>)}
            </div></section>
            <section className="palette-example"><h3>행동과 선택</h3><div className="palette-example-row"><DesignButton onClick={() => setPaletteAction('버튼을 눌렀어요.')}>주요 버튼</DesignButton><span className="palette-selected">선택된 항목</span><span className="palette-link">강조 글자</span></div><p className="gallery-caption" role="status">{paletteAction}</p></section>
            <section className="palette-example"><h3>경계와 상태</h3><div className="palette-example-row"><span className="palette-input">입력 경계 예시</span><span className="palette-focus">포커스 예시</span><DesignBadge tone="success">완료</DesignBadge><DesignBadge tone="warning">주의</DesignBadge><DesignBadge tone="error">오류</DesignBadge></div></section>
          </div>
          <div className="palette-inventory">{palette.map(group => <section className="palette-group" key={group.title}><h3>{group.title}</h3><dl>{group.items.map(([key, label]) => <div className="palette-row" key={key}><dt><span className="palette-dot" style={{backgroundColor:`var(--ds-${key})`}} aria-hidden="true" />{label}</dt><dd><span>{colorValues[key] || '—'}</span><code>--ds-{key}</code></dd></div>)}</dl></section>)}</div>
        </section>
        <footer className="gallery-footer">Pick Team · 디자인 시스템 미리보기</footer>
      </main>
    </div>
    <DesignDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="초대를 취소할까요?" actions={<><DesignButton variant="ghost" onClick={() => setDialogOpen(false)}>돌아가기</DesignButton><DesignButton variant="danger" onClick={() => setDialogOpen(false)}>초대 취소</DesignButton></>}><p>초대를 취소하면 이 링크로 참여할 수 없어요.</p></DesignDialog>
  </div>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Gallery />);
