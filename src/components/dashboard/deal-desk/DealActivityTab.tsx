'use client';

import { memo } from 'react';
import type { DealActivity } from '@/types/deals';

interface DealActivityTabProps {
  activities: DealActivity[] | undefined;
}

export const DealActivityTab = memo(function DealActivityTab({ activities }: DealActivityTabProps) {
  return (
    <div className="space-y-4">
      {activities?.map((activity) => (
        <div key={activity.id} className="flex gap-3">
          <div className="w-2 h-2 mt-2 rounded-full bg-muted-foreground" />
          <div>
            <p className="font-medium">{activity.title}</p>
            {activity.description && (
              <p className="text-sm text-muted-foreground">{activity.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(activity.created_at).toLocaleString()}
              {activity.performer && ` by ${activity.performer.name}`}
            </p>
          </div>
        </div>
      ))}

      {(!activities || activities.length === 0) && (
        <p className="text-center py-8 text-muted-foreground">No activity yet</p>
      )}
    </div>
  );
});
