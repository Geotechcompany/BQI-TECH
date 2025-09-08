/**
 * StatusHistoryTimeline Component
 * 
 * A React component that displays the status history of an application
 * in a beautiful timeline format with animations and detailed information.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  CheckCircle, 
  Code, 
  Users, 
  CheckCircle2, 
  XCircle, 
  MinusCircle,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { StatusHistoryEntry } from '@/types/application';
import { StatusHistoryManager, STATUS_CONFIG } from '@/lib/status-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface StatusHistoryTimelineProps {
  statusHistory: StatusHistoryEntry[];
  showStats?: boolean;
  compact?: boolean;
  className?: string;
}

const StatusIcons = {
  'clock': Clock,
  'check-circle': CheckCircle,
  'code': Code,
  'users': Users,
  'check-badge': CheckCircle2,
  'x-circle': XCircle,
  'minus-circle': MinusCircle
};

export function StatusHistoryTimeline({ 
  statusHistory, 
  showStats = true, 
  compact = false,
  className = ""
}: StatusHistoryTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showAllEntries, setShowAllEntries] = useState(false);
  
  const timeline = StatusHistoryManager.formatForTimeline(statusHistory);
  const stats = StatusHistoryManager.getStatusStats(statusHistory);
  
  // Show only first and last entry in compact mode, unless expanded
  const displayEntries = compact && !showAllEntries 
    ? [timeline[0], timeline[timeline.length - 1]].filter(Boolean)
    : timeline;
  
  if (!statusHistory || statusHistory.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No status history available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Status History
          </CardTitle>
          {compact && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllEntries(!showAllEntries)}
            >
              {showAllEntries ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show All ({timeline.length})
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Status Statistics */}
        {showStats && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-muted/30 rounded-lg"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Current Status</p>
                <p className="font-semibold flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[stats.currentStatus]?.bgColor}`} />
                  {stats.currentStatus}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status Changes</p>
                <p className="font-semibold">{stats.totalStatusChanges}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Processing Time</p>
                <p className="font-semibold">{stats.totalProcessingDays} days</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-semibold">
                  {StatusHistoryManager.getRelativeTime(stats.lastUpdated)}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
          
          <AnimatePresence>
            {displayEntries.map((entry, index) => {
              const IconComponent = StatusIcons[entry.config.icon as keyof typeof StatusIcons] || Clock;
              const isLast = index === displayEntries.length - 1;
              
              return (
                <motion.div
                  key={`${entry.status}-${entry.date}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative flex items-start gap-4 ${!isLast ? 'mb-6' : ''}`}
                >
                  {/* Status Icon */}
                  <div className={`
                    relative z-10 flex items-center justify-center w-12 h-12 rounded-full
                    ${entry.config.bgColor} ${entry.config.borderColor} border-2
                    shadow-lg
                  `}>
                    <IconComponent className={`h-5 w-5 ${entry.config.textColor}`} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="secondary" 
                        className={`${entry.config.bgColor} ${entry.config.textColor} border-0`}
                      >
                        {entry.config.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {entry.formattedDate}
                      </span>
                    </div>
                    
                    {entry.reason && (
                      <p className="text-sm text-foreground mb-2">
                        {entry.reason}
                      </p>
                    )}
                    
                    {/* Metadata */}
                    {(entry.changedBy || entry.metadata) && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground">
                            <ChevronDown className="h-3 w-3 mr-1" />
                            View Details
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="text-xs space-y-1 p-3 bg-muted/50 rounded-md">
                            {entry.changedBy && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span className="text-muted-foreground">Changed by:</span>
                                <span>{entry.changedBy}</span>
                              </div>
                            )}
                            
                            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                              <div className="space-y-1">
                                {Object.entries(entry.metadata).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-1">
                                    <span className="text-muted-foreground capitalize">
                                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                                    </span>
                                    <span>{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {/* Show condensed indicator in compact mode */}
          {compact && !showAllEntries && timeline.length > 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative flex items-center justify-center my-4"
            >
              <div className="absolute left-6 w-0.5 h-6 bg-dashed bg-border opacity-50" />
              <div className="ml-6 text-xs text-muted-foreground bg-background px-2">
                ... {timeline.length - 2} more status changes ...
              </div>
            </motion.div>
          )}
        </div>
        
        {/* Quick Actions */}
        {!compact && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 pt-4 border-t"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Timeline complete</span>
              <span>
                Total: {StatusHistoryManager.getTotalProcessingTime(statusHistory)} days
              </span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * StatusHistoryBadge - A compact status display with tooltip
 */
interface StatusHistoryBadgeProps {
  statusHistory: StatusHistoryEntry[];
  showCount?: boolean;
  className?: string;
}

export function StatusHistoryBadge({ 
  statusHistory, 
  showCount = true,
  className = ""
}: StatusHistoryBadgeProps) {
  const currentStatus = StatusHistoryManager.getCurrentStatus(statusHistory);
  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG['New'];
  const IconComponent = StatusIcons[config.icon as keyof typeof StatusIcons] || Clock;
  
  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <Badge 
        variant="secondary" 
        className={`${config.bgColor} ${config.textColor} border-0`}
      >
        <IconComponent className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
      {showCount && statusHistory.length > 1 && (
        <span className="text-xs text-muted-foreground">
          ({statusHistory.length - 1} changes)
        </span>
      )}
    </div>
  );
}

/**
 * StatusProgressBar - Visual progress through the hiring process
 */
interface StatusProgressBarProps {
  statusHistory: StatusHistoryEntry[];
  className?: string;
}

const STATUS_ORDER = ['New', 'Shortlisted', 'Technical Assessment', 'Interviewing', 'Hired'];

export function StatusProgressBar({ statusHistory, className = "" }: StatusProgressBarProps) {
  const currentStatus = StatusHistoryManager.getCurrentStatus(statusHistory);
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const progress = currentIndex >= 0 ? ((currentIndex + 1) / STATUS_ORDER.length) * 100 : 0;
  
  // Don't show progress for terminal states
  if (['Rejected', 'Disqualified'].includes(currentStatus)) {
    return null;
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Hiring Progress</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
        />
      </div>
      <div className="flex justify-between text-xs">
        {STATUS_ORDER.map((status, index) => (
          <span 
            key={status}
            className={index <= currentIndex ? 'text-foreground font-medium' : 'text-muted-foreground'}
          >
            {status === 'Technical Assessment' ? 'Tech' : status}
          </span>
        ))}
      </div>
    </div>
  );
}
