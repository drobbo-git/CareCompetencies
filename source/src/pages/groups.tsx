import { useMemo, useState } from "react";
import { useData } from "@/data/store";
import { useAuth } from "@/data/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Layers, Plus, Trash2 } from "lucide-react";
import type { CompetencyGroup } from "@/data/types";

export default function GroupsPage() {
  const { currentLogin } = useAuth();
  const { groups, competencies, upsertGroup, removeGroup, logAudit } = useData();

  const [editing, setEditing] = useState<CompetencyGroup | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const tree = useMemo(() => buildTree(groups), [groups]);
  const competencyCountByGroup = useMemo(() => {
    const out = new Map<string, number>();
    for (const c of competencies) {
      if (!c.groupId) continue;
      out.set(c.groupId, (out.get(c.groupId) ?? 0) + 1);
    }
    return out;
  }, [competencies]);

  if (currentLogin?.systemRole !== "Administrator") {
    return <p className="text-sm text-muted-foreground">Administrator access required.</p>;
  }

  function handleDelete(g: CompetencyGroup) {
    if (competencyCountByGroup.get(g.id) ?? 0 > 0) {
      alert(`Cannot delete "${g.name}" — it still has competencies assigned.`);
      return;
    }
    removeGroup(g.id);
    logAudit({
      actor: currentLogin!.id,
      actorRole: currentLogin!.systemRole,
      type: "GroupRemoved",
      summary: `Removed group "${g.name}"`,
      targetLabel: g.name,
    });
  }

  return (
    <>
      <PageHeader
        title="Manage Groups"
        description="Hierarchical taxonomy that organizes the competency catalog."
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New group
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {tree.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No groups yet.</div>
          )}
          <ul className="divide-y">
            {tree.map((node) => renderNode(node, 0, competencyCountByGroup, setEditing, handleDelete))}
          </ul>
        </CardContent>
      </Card>

      {(editing || showAdd) && (
        <GroupDialog
          open
          group={editing}
          onOpenChange={(o) => {
            if (!o) { setEditing(null); setShowAdd(false); }
          }}
          allGroups={groups}
          onSave={(g) => {
            upsertGroup(g);
            logAudit({
              actor: currentLogin.id,
              actorRole: currentLogin.systemRole,
              type: editing ? "GroupEdited" : "GroupAdded",
              summary: `${editing ? "Edited" : "Added"} group "${g.name}"`,
              targetLabel: g.name,
            });
            setEditing(null); setShowAdd(false);
          }}
        />
      )}
    </>
  );
}

interface TreeNode {
  group: CompetencyGroup;
  children: TreeNode[];
}

function buildTree(groups: CompetencyGroup[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const g of groups) byId.set(g.id, { group: g, children: [] });
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.group.parentGroupId;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => (a.group.orderIndex ?? 0) - (b.group.orderIndex ?? 0) || a.group.name.localeCompare(b.group.name));
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function renderNode(
  node: TreeNode,
  depth: number,
  counts: Map<string, number>,
  onEdit: (g: CompetencyGroup) => void,
  onDelete: (g: CompetencyGroup) => void,
): React.ReactNode {
  const count = counts.get(node.group.id) ?? 0;
  return (
    <>
      <li
        key={node.group.id}
        className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/40"
        style={{ paddingLeft: 16 + depth * 20 }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <button
            className="text-sm font-medium hover:underline text-left truncate"
            onClick={() => onEdit(node.group)}
          >
            {node.group.name}
          </button>
          <span className="text-[11px] text-muted-foreground">({count} competencies)</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onEdit(node.group)}>Edit</Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(node.group)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </li>
      {node.children.map((child) => renderNode(child, depth + 1, counts, onEdit, onDelete))}
    </>
  );
}

function GroupDialog({
  open, group, allGroups, onOpenChange, onSave,
}: {
  open: boolean;
  group: CompetencyGroup | null;
  allGroups: CompetencyGroup[];
  onOpenChange: (open: boolean) => void;
  onSave: (g: CompetencyGroup) => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [parentGroupId, setParentGroupId] = useState<string>(group?.parentGroupId ?? "");
  const [orderIndex, setOrderIndex] = useState<number>(group?.orderIndex ?? 0);

  function handleSave() {
    if (!name.trim()) return;
    const g: CompetencyGroup = {
      id: group?.id ?? `g-${Math.random().toString(36).slice(2, 10)}`,
      name: name.trim(),
      parentGroupId: parentGroupId || null,
      orderIndex,
    };
    onSave(g);
  }

  const parentOptions = allGroups.filter((g) => g.id !== group?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{group ? "Edit group" : "New group"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Parent group</Label>
            <Select value={parentGroupId} onValueChange={setParentGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="(top-level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">(top-level)</SelectItem>
                {parentOptions.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sort order</Label>
            <Input
              type="number"
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}