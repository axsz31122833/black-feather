import React, { useEffect, useState } from 'react';
import invokeWithAuth from '../lib/functions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await invokeWithAuth('list-users', { page, pageSize, keyword });
      setUsers(data?.users || []);
    } catch (e) {
      toast({ title: '載入失敗', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [page]);

  const promoteToDriver = async (user) => {
    try {
      await invokeWithAuth('update-user-role', { userId: user.id, newRole: 'driver' });
      toast({ title: '升級成功', description: `${user.display_name || user.name} 已升級為司機`, variant: 'success' });
      loadUsers();
    } catch (e) {
      toast({ title: '升級失敗', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4">
      <Card className="glass">
        <CardHeader>
          <CardTitle>使用者管理</CardTitle>
          <CardDescription>管理員：升級使用者為司機</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜尋名稱或手機" />
            <Button onClick={() => { setPage(1); loadUsers(); }}>搜尋</Button>
            <Button variant="outline" onClick={() => navigate('/admin')}>返回儀表板</Button>
          </div>

          {loading ? (
            <p>載入中...</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 border rounded-md bg-background/30">
                  <div className="flex items-center gap-3">
                    <Badge>{u.role}</Badge>
                    <div>
                      <div className="font-medium">{u.display_name || u.name || u.phone}</div>
                      <div className="text-xs text-muted-foreground">{u.phone}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => promoteToDriver(u)} disabled={u.role === 'driver'}>升級為司機</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminUsersPage;