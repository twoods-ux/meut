import Image from "next/image";

/** Full M.E.U.T. wordmark (blue logo). */
export function MeutLogo({
  className = "h-auto w-full max-w-[240px]",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/meut-logo.png"
      alt="M.E.U.T. — Medical Equipment User Tracking"
      width={320}
      height={120}
      className={className}
      priority={priority}
    />
  );
}
