import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LP コスト検証ツール',
  description: 'LP制作ビジネスのコスト・利益検証ツール',
};

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
