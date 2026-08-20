type IconProps = { className?: string };

export function GitHubIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.86v2.76c0 .26.18.58.69.48A10 10 0 0 0 12 2z"
      />
    </svg>
  );
}

export function YouTubeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#FF0000"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.6 12 3.6 12 3.6s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8z"
      />
      <path fill="#fff" d="M9.8 15.5V8.5L15.7 12z" />
    </svg>
  );
}

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z"
      />
    </svg>
  );
}

export function MediumIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M13.54 12a6.9 6.9 0 0 1-6.93 6.91A6.9 6.9 0 0 1 0 12a6.9 6.9 0 0 1 6.61-6.91A6.9 6.9 0 0 1 13.54 12zM20.96 12c0 3.54-1.55 6.41-3.46 6.41s-3.46-2.87-3.46-6.41 1.55-6.41 3.46-6.41 3.46 2.87 3.46 6.41zm3.04 0c0 3.17-.53 5.75-1.19 5.75s-1.19-2.58-1.19-5.75.53-5.75 1.19-5.75S24 8.83 24 12z"
      />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4.24-8 5.33-8-5.33V6l8 5.33L20 6z"
      />
    </svg>
  );
}

export function PdfIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#E5252A" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path fill="#fff" d="M14 2v6h6" opacity="0.35" />
      <path
        fill="#fff"
        d="M7.2 15.7c.7-2.2 1.3-4.1 1.8-6.2h1.3c-.4 1.8-.9 3.7-1.5 6.2H7.2zm5.1-6.2h1.5c.7 1.9 1.6 3.7 2.7 5.3l-1.2.6c-.9-1.4-1.7-3-2.3-4.6v4.9h-1.2V9.5h.5zm-4.3 7.8c.2.7.4 1.4.5 2.2H7.2c.2-.7.4-1.5.7-2.2h.1z"
      />
    </svg>
  );
}

export function LabsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.4 9h-3.1a15.4 15.4 0 0 0-1.2-5 8.05 8.05 0 0 1 4.3 5zM12 4.1c.8 1.2 1.8 3.2 2.2 6.9H9.8C10.2 7.3 11.2 5.3 12 4.1zM4.6 13h3.1a15.4 15.4 0 0 0 1.2 5 8.05 8.05 0 0 1-4.3-5zM8.9 11H4.6a8.05 8.05 0 0 1 4.3-5 15.4 15.4 0 0 0-1.2 5zM12 19.9c-.8-1.2-1.8-3.2-2.2-6.9h4.4c-.4 3.7-1.4 5.7-2.2 6.9zm3.1-1.9a15.4 15.4 0 0 0 1.2-5h3.1a8.05 8.05 0 0 1-4.3 5z"
      />
    </svg>
  );
}
