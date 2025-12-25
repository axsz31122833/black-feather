import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import MapSelector from '../components/MapSelector.jsx';
import { loadGoogleMaps } from '../lib/mapsLoader.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useToast } from '../hooks/use-toast';
import { formatDate, formatCurrency, getStatusColor, getStatusText, formatPhone } from '../lib/utils';
import { 
  Users, 
  Car, 
  Activity, 
  TrendingUp, 
  Clock, 
  LogOut,
  RefreshCw,
  Eye,
  CheckCircle,
  AlertCircle,
  MapPin,
  Navigation,
  Phone,
  User,
  BarChart3
} from 'lucide-react';

function AdminDashboard() {
  const { 
    user, 
    drivers, 
    orders, 
    stats, 
    loading, 
    loadDrivers, 
    loadOrders, 
    logout 
  } = useApp();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadDrivers();
    loadOrders();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadDrivers(),
        loadOrders()
      ]);
      toast({
        title: '已更新',
        description: '所有數據已更新',
        variant: 'success'
      });
    } catch (error) {
      toast({
        title: '更新失敗',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (_) {}
    toast({
      title: '您已登出，返回主畫面中...',
      description: '感謝您的管理工作！',
      variant: 'success'
    });
    setTimeout(() => {
      try { navigate('/'); } catch (_) { window.location.href = '/'; }
    }, 1500);
  };

  // 統計數據
  const totalRevenue = orders
    .filter(order => order.status === 'completed')
    .reduce((sum, order) => sum + (order.estimatedPrice || 0), 0);
  
  const todayOrders = orders.filter(order => {
    const today = new Date().toDateString();
    const orderDate = new Date(order.createdAt).toDateString();
    return today === orderDate;
  });

  const recentOrders = orders.slice(0, 10);
  const activeDrivers = drivers.filter(driver => driver.status !== 'offline');

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* 標題列 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              管理中心
            </h1>
            <p className="text-gray-300">
              Black Feather 車隊管理系統 - {user?.name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh} 
              disabled={loading || refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
              更新數據
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              登出
            </Button>
          </div>
        </div>

        {/* 概覽統計 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">總司機數</p>
                  <p className="text-2xl font-bold">{drivers.length}</p>
                  <p className="text-xs text-muted-foreground">
                    在線: {activeDrivers.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">總訂單數</p>
                  <p className="text-2xl font-bold">{orders.length}</p>
                  <p className="text-xs text-muted-foreground">
                    今日: {todayOrders.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">已完成</p>
                  <p className="text-2xl font-bold">
                    {orders.filter(o => o.status === 'completed').length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    進行中: {orders.filter(o => ['requested','assigned','accepted','enroute','arrived'].includes(o.status)).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">總收入</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(totalRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    平均: {formatCurrency(totalRevenue / (orders.filter(o => o.status === 'completed').length || 1))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 主要內容 */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              概覽
            </TabsTrigger>
            <TabsTrigger value="drivers">
              <Car className="w-4 h-4 mr-2" />
              司機管理
            </TabsTrigger>
            <TabsTrigger value="orders">
              <Clock className="w-4 h-4 mr-2" />
              訂單管理
            </TabsTrigger>
            <TabsTrigger value="realtime">
              <Activity className="w-4 h-4 mr-2" />
              即時監控
            </TabsTrigger>
          </TabsList>

          {/* 概覽頁面 */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* 司機狀態分佈 */}
              <Card className="glass card-hover">
                <CardHeader>
                  <CardTitle>司機狀態分佈</CardTitle>
                  <CardDescription>目前所有司機的狀態統計</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-background/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>閒置中</span>
                      </div>
                      <span className="font-semibold">
                        {drivers.filter(d => d.status === 'idle').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span>忙碌中</span>
                      </div>
                      <span className="font-semibold">
                        {drivers.filter(d => d.status === 'busy').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span>離線</span>
                      </div>
                      <span className="font-semibold">
                        {drivers.filter(d => d.status === 'offline').length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 訂單狀態分佈 */}
              <Card className="glass card-hover">
                <CardHeader>
                  <CardTitle>訂單狀態分佈</CardTitle>
                  <CardDescription>所有訂單的狀態統計</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-background/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span>處理中</span>
                      </div>
                      <span className="font-semibold">
                        {orders.filter(o => ['requested','assigned','accepted','enroute','arrived'].includes(o.status)).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span>已完成</span>
                      </div>
                      <span className="font-semibold">
                        {orders.filter(o => o.status === 'completed').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>今日訂單</span>
                      </div>
                      <span className="font-semibold">
                        {todayOrders.length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 司機管理 */}
          <TabsContent value="drivers" className="space-y-4">
            <Card className="glass card-hover">
              <CardHeader>
                <CardTitle>司機列表</CardTitle>
                <CardDescription>所有司機的詳細資訊和狀態</CardDescription>
              </CardHeader>
              <CardContent>
                {drivers.length > 0 ? (
                  <div className="space-y-3">
                    {drivers.map((driver) => {
                      const driverOrders = orders.filter(o => o.driverPhone === driver.phone);
                      const completedOrders = driverOrders.filter(o => o.status === 'completed');
                      const earnings = completedOrders.reduce((sum, o) => sum + (o.estimatedPrice || 0), 0);
                      
                      return (
                        <div key={driver.phone} className="p-4 bg-background/20 rounded-lg border border-border/50">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <User className="w-4 h-4" />
                                <span className="font-semibold">{driver.name}</span>
                                <Badge className={getStatusColor(driver.status)} size="sm">
                                  {getStatusText(driver.status)}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {formatPhone(driver.phone)}
                              </p>
                              {driver.vehicle && (
                                <p className="text-sm text-muted-foreground">
                                  {driver.vehicle.plate} - {driver.vehicle.model}
                                </p>
                              )}
                            </div>
                            
                            <div className="text-center">
                              <p className="text-lg font-semibold">{driverOrders.length}</p>
                              <p className="text-xs text-muted-foreground">總訂單數</p>
                            </div>
                            
                            <div className="text-center">
                              <p className="text-lg font-semibold">{completedOrders.length}</p>
                              <p className="text-xs text-muted-foreground">已完成</p>
                            </div>
                            
                            <div className="text-center">
                              <p className="text-lg font-semibold text-green-400">
                                {formatCurrency(earnings)}
                              </p>
                              <p className="text-xs text-muted-foreground">總收入</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Car className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">系統中無司機資料</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 訂單管理 */}
          <TabsContent value="orders" className="space-y-4">
            <Card className="glass card-hover">
              <CardHeader>
                <CardTitle>訂單列表</CardTitle>
                <CardDescription>所有訂單的詳細記錄</CardDescription>
              </CardHeader>
              <CardContent>
                {recentOrders.length > 0 ? (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="p-4 bg-background/20 rounded-lg border border-border/50">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getStatusColor(order.status)} size="sm">
                                {getStatusText(order.status)}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {formatDate(order.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              訂單編號：{order.id.slice(-8)}
                            </p>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm min-w-0">
                              <MapPin className="w-3 h-3 text-green-500" />
                              <span className="truncate">{order.pickup}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm min-w-0">
                              <Navigation className="w-3 h-3 text-red-500" />
                              <span className="truncate">{order.dropoff}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="text-sm">
                              <span className="text-muted-foreground">乘客：</span>
                              {order.passengerPhone}
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">司機：</span>
                              {order.driverName}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="font-semibold text-green-400">
                              {formatCurrency(order.estimatedPrice)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {order.status === 'completed' ? '已收費' : '預估金額'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {orders.length > 10 && (
                      <div className="text-center pt-4">
                        <p className="text-sm text-muted-foreground">
                          顯示最近 10 筆記錄，共 {orders.length} 筆訂單
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">系統中無訂單資料</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 即時監控 */}
          <TabsContent value="realtime" className="space-y-4">
            <div className="grid xl:grid-cols-3 gap-6">
              {/* 即時狀態 */}
              <Card className="glass card-hover xl:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    即時狀態
                  </CardTitle>
                  <CardDescription>系統即時運行狀態</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-background/20 rounded-lg">
                      <span>線上司機</span>
                      <span className="font-semibold text-green-400">{activeDrivers.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background/20 rounded-lg">
                      <span>可用司機</span>
                      <span className="font-semibold text-blue-400">
                        {drivers.filter(d => d.status === 'idle').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background/20 rounded-lg">
                      <span>進行中訂單</span>
                      <span className="font-semibold text-orange-400">
                        {orders.filter(o => ['requested','assigned','accepted','enroute','arrived'].includes(o.status)).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background/20 rounded-lg">
                      <span>今日總訂單</span>
                      <span className="font-semibold text-purple-400">{todayOrders.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 即時地圖 */}
              <Card className="glass card-hover xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    即時地圖
                  </CardTitle>
                  <CardDescription>顯示線上司機與訂單的地理位置</CardDescription>
                </CardHeader>
                <CardContent>
                  <AdminRealtimeMap drivers={activeDrivers} orders={orders.filter(o => ['requested','assigned','accepted','enroute','arrived'].includes(o.status))} />
                </CardContent>
              </Card>

              {/* 系統警示 */}
              <Card className="glass card-hover xl:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    系統警示
                  </CardTitle>
                  <CardDescription>需要關注的系統狀態</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {drivers.filter(d => d.status === 'idle').length === 0 && (
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm">無可用司機</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          目前所有司機都不可用，新訂單無法分配
                        </p>
                      </div>
                    )}
                    
                    {orders.filter(o => ['requested','assigned','accepted','enroute','arrived'].includes(o.status)).length > 5 && (
                      <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                          <span className="text-sm">訂單積壓</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          有較多訂單在處理中，請留意運能狀態
                        </p>
                      </div>
                    )}
                    
                    {drivers.filter(d => d.status === 'offline').length > drivers.length * 0.5 && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm">司機離線率高</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          超過半數司機處於離線狀態
                        </p>
                      </div>
                    )}
                    
                    {(
                      drivers.filter(d => d.status === 'idle').length > 0 &&
                      orders.filter(o => ['requested','assigned','accepted','enroute','arrived'].includes(o.status)).length === 0 &&
                      drivers.filter(d => d.status === 'offline').length <= drivers.length * 0.5
                    ) && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm">系統運行正常</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          所有系統狀態正常，無需特別關注
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default AdminDashboard;

function AdminRealtimeMap({ drivers, orders }) {

  const markers = useMemo(() => {
    const ds = (drivers || [])
      .filter(d => d.lat && d.lng)
      .map(d => ({ id: `driver-${d.phone}`, position: { lat: Number(d.lat), lng: Number(d.lng) }, label: `司機 ${d.name}` }));
    const os = (orders || [])
      .flatMap(o => {
        const arr = [];
        if (o.pickup_lat && o.pickup_lng) arr.push({ id: `order-${o.id}-pickup`, position: { lat: Number(o.pickup_lat), lng: Number(o.pickup_lng) }, label: '上車點' });
        if (o.dropoff_lat && o.dropoff_lng) arr.push({ id: `order-${o.id}-dropoff`, position: { lat: Number(o.dropoff_lat), lng: Number(o.dropoff_lng) }, label: '下車點' });
        return arr;
      });
    return [...ds, ...os];
  }, [drivers, orders]);

  const polylines = useMemo(() => {
    return (orders || [])
      .filter(o => o.pickup_lat && o.pickup_lng && o.dropoff_lat && o.dropoff_lng)
      .map(o => ({
        id: `poly-${o.id}`,
        path: [
          { lat: Number(o.pickup_lat), lng: Number(o.pickup_lng) },
          { lat: Number(o.dropoff_lat), lng: Number(o.dropoff_lng) }
        ],
        color: '#22c55e'
      }));
  }, [orders]);

  const center = useMemo(() => {
    const d = (drivers || []).find(x => x.lat && x.lng);
    if (d) return { lat: Number(d.lat), lng: Number(d.lng) };
    const o = (orders || []).find(x => x.pickup_lat && x.pickup_lng);
    if (o) return { lat: Number(o.pickup_lat), lng: Number(o.pickup_lng) };
    return { lat: 25.033964, lng: 121.564468 };
  }, [drivers, orders]);

  return (
    <div className="w-full h-[480px] border rounded overflow-hidden">
      <MapSelector center={center} markers={markers} polylines={polylines} zoom={12} />
    </div>
  );
}
