export const IconoVisual = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
  <svg viewBox="0 0 24 24" className={`vark-icon ${active ? 'active vark-v' : ''}`} onClick={onClick} >
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
    <circle cx="12" cy="12" r="3" fill={active ? "#11131A" : "currentColor"} />
    <circle cx="13" cy="11" r="1" fill={active ? "#1C51FF" : "currentColor"} />
  </svg>
);

export const IconoAuditivo = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
  <svg viewBox="0 0 24 24" className={`vark-icon ${active ? 'active vark-a' : ''}`} onClick={onClick} >
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
  </svg>
);

export const IconoLectura = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
  <svg viewBox="0 0 24 24" className={`vark-icon ${active ? 'active vark-r' : ''}`} onClick={onClick} >
    <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
  </svg>
);

export const IconoKinestesico = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
  <svg viewBox="0 0 24 24" className={`vark-icon ${active ? 'active vark-k' : ''}`} onClick={onClick} >
    <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>
  </svg>
);