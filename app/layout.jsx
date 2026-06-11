export const metadata = {
  title: "The Study Gazette",
  description: "Papers, projects & half-formed theories — 개인 공부 저널 & 포트폴리오",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
