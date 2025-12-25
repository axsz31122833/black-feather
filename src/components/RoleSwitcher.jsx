import React, { useState } from 'react';
import invokeWithAuth from '../lib/functions';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useToast } from '../hooks/use-toast';

function RoleSwitcher() {
  const { user, setUser } = useApp();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const switchTo = async (target) => {
    if (user.role === target) return;
    setLoading(true);
    try {
      // 僅視覺切換；後端權限由 user_permissions 控制
      setUser({ ...user, role: target });
      toast({ title: '角色切換', description: `已切換為 ${target}`, variant: 'success' });
    } catch (e) {
      toast({ title: '切換失敗', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge>{user.role}</Badge>
      <Button variant="outline" size="sm" disabled={loading} onClick={() => switchTo('passenger')}>乘客</Button>
      <Button variant="outline" size="sm" disabled={loading} onClick={() => switchTo('driver')}>司機</Button>
      {user.permissions?.can_access_admin && (
        <Button variant="outline" size="sm" disabled={loading} onClick={() => switchTo('admin')}>管理員</Button>
      )}
    </div>
  );
}

export default RoleSwitcher;