import Image from "next/image";
import Link from "next/link";

export function Logo({
  href = "/",
  size = 32,
}: {
  href?: string;
  size?: number;
}) {
  return (
    <Link href={href} className="logo-link flex items-center gap-3">      <Image
        src="/logo.png"
        alt="DealFlow"
        width={size}
        height={size}
        priority
        className="rounded"
      />
      <span className="font-bold text-[17px] tracking-tight">DealFlow</span>
    </Link>
  );
}