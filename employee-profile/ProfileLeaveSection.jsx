import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Loader2 } from 'lucide-react';
import { format, parseISO, isBefore, startOfToday } from 'date-fns';
import LeaveBalanceTiles from '@/components/leave/LeaveBalanceTiles';
import { subscribeToLeaveCache, getLeaveEngineCacheVersion } from '@/components/utils/leaveEngineCache';

const LeaveRequest = base44.entities.LeaveRequest;
const LeaveType = base44.entities.LeaveType;

export default function ProfileLeaveSection({ employee }) {
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(getLeaveEngineCacheVersion());

  // Subscribe to leave cache for instant balance updates
  useEffect(() => {
    const unsubscribe = subscribeToLeaveCache((version) => {
      setBalanceRefreshKey(version);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (employee?.id) {
      loadLeaveData();
    }
  }, [employee?.id]);

  const loadLeaveData = async () => {
    setIsLoading(true);
    try {
      const [reqs, types] = await Promise.all([
        LeaveRequest.filter({ employee_id: employee.id }),
        LeaveType.list(),
      ]);
      // Sort by start_date descending
      reqs.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
      setRequests(reqs);
      setLeaveTypes(types);
    } catch (error) {
      console.error('Error loading leave data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeName = (typeId) => leaveTypes.find(t => t.id === typeId)?.name || 'Unknown';

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      declined: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-500',
    };
    return <Badge className={styles[status] || 'bg-gray-100 text-gray-700'}>{status}</Badge>;
  };

  const today = startOfToday();
  const upcomingRequests = requests.filter(r => 
    (r.status === 'approved' || r.status === 'pending') && 
    !isBefore(parseISO(r.start_date), today)
  );
  const pastRequests = requests.filter(r => 
    isBefore(parseISO(r.start_date), today) || r.status === 'declined' || r.status === 'cancelled'
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Leave Balances using shared component */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Leave Balances</h3>
          </div>
          <LeaveBalanceTiles employeeId={employee.id} refreshKey={balanceRefreshKey} />
        </CardContent>
      </Card>

      {/* Upcoming Leave */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Leave</h3>
          </div>
          {upcomingRequests.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming leave scheduled</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcomingRequests.map(req => (
                <div key={req.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{getTypeName(req.leave_type_id)}</p>
                    <p className="text-sm text-gray-500">
                      {format(parseISO(req.start_date), 'dd MMM')} – {format(parseISO(req.end_date), 'dd MMM yyyy')}
                      <span className="ml-2 text-gray-400">({req.total_days} days)</span>
                    </p>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Leave */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Leave History</h3>
          </div>
          {pastRequests.length === 0 ? (
            <p className="text-sm text-gray-500">No leave history</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {pastRequests.slice(0, 20).map(req => (
                <div key={req.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{getTypeName(req.leave_type_id)}</p>
                    <p className="text-sm text-gray-500">
                      {format(parseISO(req.start_date), 'dd MMM')} – {format(parseISO(req.end_date), 'dd MMM yyyy')}
                      <span className="ml-2 text-gray-400">({req.total_days} days)</span>
                    </p>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}