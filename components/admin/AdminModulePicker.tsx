"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ADMIN_MODULE_DEFINITIONS,
  AdminModuleKey,
  groupModulesByCategory,
  isSuperAdmin,
} from "@/lib/admin-permissions";

interface AdminModulePickerProps {
  selected: AdminModuleKey[];
  onChange: (modules: AdminModuleKey[]) => void;
  role: string;
  disabled?: boolean;
  className?: string;
}

export function AdminModulePicker({
  selected,
  onChange,
  role,
  disabled = false,
  className,
}: AdminModulePickerProps) {
  const superAdmin = isSuperAdmin(role);
  const grouped = groupModulesByCategory(ADMIN_MODULE_DEFINITIONS);

  const toggleModule = (key: AdminModuleKey, checked: boolean) => {
    if (superAdmin) return;
    if (checked) {
      onChange(Array.from(new Set([...selected, key])));
      return;
    }
    onChange(selected.filter((item) => item !== key));
  };

  const selectAll = () => {
    onChange(ADMIN_MODULE_DEFINITIONS.map((m) => m.key));
  };

  const clearAll = () => {
    onChange(["overview", "help"]);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Module access</p>
          <p className="text-xs text-muted-foreground">
            Choose which admin areas this user can open.
          </p>
        </div>
        {!superAdmin && !disabled && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-muted-foreground hover:underline"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {superAdmin ? (
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
          Super admins automatically receive full access to every module.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(grouped).map(([group, modules]) => (
            <div
              key={group}
              className="rounded-xl border border-border/60 bg-muted/20 p-4"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              <div className="space-y-3">
                {modules.map((module) => {
                  const checked = selected.includes(module.key);
                  return (
                    <label
                      key={module.key}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2 transition-colors",
                        checked && "border-primary/20 bg-primary/5",
                        disabled && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          toggleModule(module.key, value === true)
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {module.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {module.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
