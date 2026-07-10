import { Link } from "@tanstack/react-router";
import type { CrewMember } from "../domain/crew";
import { cn } from "../lib/cn";
import { CrewAvatar } from "./CrewAvatar";

type CrewMembersGridProps = {
  members: CrewMember[];
  className?: string;
  avatarClassName?: string;
};

export function CrewMembersGrid({ members, className, avatarClassName = "size-20" }: CrewMembersGridProps) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-3", className)}>
      {members.map((member) => (
        <Link
          key={member.id}
          to="/crew"
          className="m-2 inline-flex w-20 flex-col items-center text-center no-underline transition hover:opacity-80"
        >
          <CrewAvatar name={member.name} imageUrl={member.imageUrl} className={avatarClassName} />
          <p className="m-0 mt-1.5 w-full truncate text-xs font-semibold text-[var(--sea-ink)] sm:text-sm">
            {member.name}
          </p>
        </Link>
      ))}
    </div>
  );
}
