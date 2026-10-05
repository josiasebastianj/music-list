"use client";

import { useRef } from "react";
import Icon from "./Icon";
import type { Member } from "@/lib/event";

type Props = { members: Member[]; readOnly: boolean; onChange: (members: Member[]) => void };

export default function TeamDialog({ members, readOnly, onChange }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const setMember = (i: number, patch: Partial<Member>) => onChange(members.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <>
      <button className="btn team-btn" type="button" onClick={() => dialogRef.current?.showModal()}>
        <Icon name="users" />
        Team
        {members.length > 0 && <span className="team-count">{members.length}</span>}
      </button>
      <dialog
        ref={dialogRef}
        className="share-dialog"
        aria-labelledby="teamDialogTitle"
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
      >
        <form method="dialog" className="share-dialog-inner">
          <div className="share-dialog-title" id="teamDialogTitle">Team</div>
          {members.length === 0 && (
            <p className="share-dialog-copy">{readOnly ? "No team members yet." : "No team members yet. Add one below."}</p>
          )}
          {readOnly ? (
            members.length > 0 && (
              <ul className="team-list">
                {members.map((m, i) => (
                  <li key={i}>
                    <span className="team-role">{m.role.trim() || "—"}</span>
                    <span className="team-name">{m.name.trim() || "Unnamed"}</span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              {members.map((m, i) => (
                // index keys are fine here: the inputs are controlled, so their values follow the array
                <div className="team-row" key={i}>
                  <input className="team-input" value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} placeholder="Name" aria-label={`Member ${i + 1} name`} />
                  <input className="team-input" value={m.role} onChange={(e) => setMember(i, { role: e.target.value })} placeholder="Role" aria-label={`Member ${i + 1} role`} />
                  <button className="icon-btn danger" type="button" title="Remove member" aria-label={`Remove member ${i + 1}`} onClick={() => onChange(members.filter((_, j) => j !== i))}>
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
              <button className="btn add-detail" type="button" onClick={() => onChange([...members, { name: "", role: "" }])}>
                <Icon name="plus" />
                Add member
              </button>
            </>
          )}
          <div className="share-dialog-actions">
            <button className="btn primary" type="submit">{readOnly ? "Close" : "Done"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
