import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import { formatDate, formatCurrency, getStatusColor, getStatusText } from '../lib/utils';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  User, 
  Car, 
  LogOut,
  RefreshCw,
  History,
  Phone
} from 'lucide-react';
import OSMMap from '../components/OSMMap';

function PassengerDashboard() {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [center, setCenter] = useState({ lat: 25.033964, lng: 121.564468 });
  const [pickupCoord, setPickupCoord] = useState(null);
  const [dropoffCoord, setDropoffCoord] = useState(null);
  const [routeInfo, setRouteInfo] = useState({ distanceMeters: 0, durationSeconds: 0, polylinePath: [] });
  const [mapProvider, setMapProvider] = useState('osm');
  const [geoDenied, setGeoDenied] = useState(false);
  const [ipFallbackUsed, setIpFallbackUsed] = useState(false);
  const { 
    user, 
    orders, 
    currentOrder, 
    loading, 
    requestRide, 
    loadOrders, 
    logout 
  } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.phone) {
      loadOrders(user.phone);
    }
  }, [user]);

  // 初次載入定位並預設上車點
  useEffect(() => {
    async function fetchIpLocation() {
      try {
        // 先嘗試 https://ipapi.co
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          const lat = Number(data?.latitude);
          const lng = Number(data?.longitude);
          if (lat && lng) {
            const coord = { lat, lng };
            setCenter(coord);
            setPickupCoord(coord);
            if (!pickup) setPickup('估算位置');
            setIpFallbackUsed(true);
            return;
          }
        }
      } catch (_) {}
      try {
        // 備援 http://ip-api.com
        const res2 = await fetch('http://ip-api.com/json');
        if (res2.ok) {
          const data2 = await res2.json();
          const lat = Number(data2?.lat);
          const lng = Number(data2?.lon);
          if (lat && lng) {
            const coord = { lat, lng };
            setCenter(coord);
            setPickupCoord(coord);
            if (!pickup) setPickup('估算位置');
            setIpFallbackUsed(true);
          }
        }
      } catch (_) {}
    }

    if (!navigator?.geolocation) {
      // 無 geolocation，改用 IP-based
      fetchIpLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords || {};
      if (latitude && longitude) {
        const coord = { lat: latitude, lng: longitude };
        setCenter(coord);
        setPickupCoord(coord);
        if (!pickup) setPickup('目前位置');
      }
    }, (err) => {
      console.warn('定位失敗或被拒絕', err);
      setGeoDenied(true);
      // 失敗時嘗試 IP-based 定位
      fetchIpLocation();
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
  }, []);

  async function geocodeAddress(text) {
    if (!text || !text.trim()) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text.trim())}`;
      const res = await fetch(url);
      const list = await res.json();
      const first = list?.[0];
      if (first) {
        return { lat: Number(first.lat), lng: Number(first.lon) };
      }
    } catch (e) {
      console.warn('地點地理編碼失敗', e);
    }
    return null;
  }

  const handleRequestRide = async (e) => {
    e.preventDefault();
    
    if (!pickupCoord || !pickup.trim() || !dropoff.trim()) {
      toast({
        title: '輸入錯誤',
        description: '請確認上車與下車地點已輸入',
        variant: 'destructive'
      });
      return;
    }

    setRequesting(true);
    
    try {
      const estimatedPrice = Math.round(((routeInfo?.distanceMeters || 0) / 1000) * 20 + 85);
      const result = await requestRide({
        passengerPhone: user.phone,
        pickup: pickup.trim(),
        dropoff: dropoff.trim(),
        pickup_lat: pickupCoord?.lat,
        pickup_lng: pickupCoord?.lng,
        dropoff_lat: dropoffCoord?.lat,
        dropoff_lng: dropoffCoord?.lng,
        estimated_distance_meters: routeInfo?.distanceMeters,
        estimated_duration_seconds: routeInfo?.durationSeconds,
        estimated_price: estimatedPrice,
        map_provider: mapProvider
      });
      
      toast({
        title: '叫車成功',
        description: `已分配司機: ${result.driver.name}`,
        variant: 'success'
      });
      
      // 清空表單
      setPickup('');
      setDropoff('');
      setPickupCoord(null);
      setDropoffCoord(null);
      setRouteInfo({ distanceMeters: 0, durationSeconds: 0, polylinePath: [] });
      
      // 重新加載訂單
      loadOrders(user.phone);
      
    } catch (error) {
      console.error('叫車失敗詳細：', error);
      toast({
        title: '叫車失敗',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setRequesting(false);
    }
  };

  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    toast({
      title: '您已登出，返回主畫面中...',
      description: '謝謝使用 Black Feather 車隊系統',
      variant: 'success'
    });
    setTimeout(() => {
      try { navigate('/'); } catch (_) { window.location.href = '/'; }
    }, 1500);
  };

  const handleRefresh = () => {
    loadOrders(user.phone);
    toast({
      title: '已更新',
      description: '訂單資料已更新',
      variant: 'success'
    });
  };

  const pendingOrders = orders.filter(order => order.status === 'requested');
  const completedOrders = orders.filter(order => order.status === 'completed');

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* 標題列 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              乘客中心
            </h1>
            <p className="text-gray-300">
              歡迎，{user?.name} （{user?.phone}）
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              更新
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              登出
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* 叫車表單 */}
          <Card className="glass card-hover lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                叫車服務
              </CardTitle>
              <CardDescription>
                輸入上下車地點，系統將自動分配最近的司機
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRequestRide} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    上車地點
                  </div>
                  <Input
                    placeholder="例：台北車站"
                    value={pickup}
                    list="popular-spots"
                    onChange={async (e) => {
                      const v = e.target.value;
                      setPickup(v);
                      const coord = await geocodeAddress(v);
                      if (coord) {
                        setPickupCoord(coord);
                        setCenter(coord);
                      }
                    }}
                    className="bg-background/50"
                    disabled={requesting}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Navigation className="w-4 h-4" />
                    下車地點
                  </div>
                  <Input
                    placeholder="例：松山機場"
                    value={dropoff}
                    list="popular-spots"
                    onChange={async (e) => {
                      const v = e.target.value;
                      setDropoff(v);
                      const coord = await geocodeAddress(v);
                      if (coord) {
                        setDropoffCoord(coord);
                      }
                    }}
                    className="bg-background/50"
                    disabled={requesting}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full btn-primary"
                  disabled={requesting || pendingOrders.length > 0 || !pickupCoord}
                >
                  {requesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      叫車中...
                    </>
                  ) : pendingOrders.length > 0 ? (
                    '您有未完成的訂單'
                  ) : (
                    '立即叫車'
                  )}
                </Button>
                <datalist id="popular-spots">
                  <option value="台北車站" />
                  <option value="松山機場" />
                  <option value="台北 101" />
                  <option value="西門町" />
                  <option value="士林夜市" />
                </datalist>
              </form>
            </CardContent>
          </Card>

          {/* 常駐地圖與即時路線 */}
          <Card className="glass card-hover lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                即時地圖
              </CardTitle>
              <CardDescription>
                可拖曳與縮放，顯示上下車地點與路線
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[420px] border rounded overflow-hidden">
                <OSMMap
                  center={center}
                  pickupCoord={pickupCoord}
                  dropoffCoord={dropoffCoord}
                  onRouteUpdate={(info) => setRouteInfo(info)}
                  onTileError={() => setMapProvider('maplibre')}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
                <div className="p-3 rounded border bg-background/30">
                  <div className="text-muted-foreground">預估距離</div>
                  <div className="font-semibold">{(routeInfo?.distanceMeters || 0) > 0 ? `${(routeInfo.distanceMeters / 1000).toFixed(2)} 公里` : '—'}</div>
                </div>
                <div className="p-3 rounded border bg-background/30">
                  <div className="text-muted-foreground">預估時間</div>
                  <div className="font-semibold">{(routeInfo?.durationSeconds || 0) > 0 ? `${Math.round(routeInfo.durationSeconds / 60)} 分鐘` : '—'}</div>
                </div>
                <div className="p-3 rounded border bg-background/30">
                  <div className="text-muted-foreground">預估金額（僅供參考）</div>
                  <div className="font-semibold">{formatCurrency(Math.round(((routeInfo?.distanceMeters || 0) / 1000) * 20 + 85))}</div>
                </div>
              </div>
              {geoDenied && (
                <div className="text-xs text-yellow-400 mt-2">請開啟定位服務</div>
              )}
              {ipFallbackUsed && (
                <div className="text-xs text-muted-foreground mt-1">已使用 IP 定位作為預設上車地點（準確度較低）</div>
              )}
              {mapProvider === 'maplibre' && (
                <div className="text-xs text-yellow-400 mt-2">地圖載入中斷，已自動切換備援地圖。</div>
              )}
            </CardContent>
          </Card>

          {/* 當前訂單狀態 */}
          <Card className="glass card-hover lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                當前訂單
              </CardTitle>
              <CardDescription>
                {pendingOrders.length > 0 ? '您的當前訂單狀態' : '目前沒有進行中的訂單'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingOrders.length > 0 ? (
                <div className="space-y-4">
                  {pendingOrders.map((order) => (
                    <div key={order.id} className="bg-background/30 rounded-lg p-4 border border-border">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            訂單編號：{order.id}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-primary">
                            {formatCurrency(order.estimatedPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            預估金額
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <MapPin className="w-4 h-4 text-green-500" />
                            <span className="text-muted-foreground">上車：</span>
                            <span className="truncate">{order.pickup}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <Navigation className="w-4 h-4 text-red-500" />
                            <span className="text-muted-foreground">下車：</span>
                            <span className="truncate">{order.dropoff}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-muted-foreground">時間：</span>
                            <span>{formatDate(order.createdAt)}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <User className="w-4 h-4 text-purple-500" />
                            <span className="text-muted-foreground">司機：</span>
                            <span className="truncate">{order.driverName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <Phone className="w-4 h-4 text-orange-500" />
                            <span className="text-muted-foreground">電話：</span>
                            <span className="truncate">{order.driverPhone}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Car className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    目前沒有進行中的訂單
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    使用左側表單可以快速叫車
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 歷史訂單 */}
        <Card className="glass card-hover mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              歷史訂單
            </CardTitle>
            <CardDescription>
              您的所有訂單記錄
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length > 0 ? (
              <div className="space-y-3">
                {orders.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-background/20 rounded-lg border border-border/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getStatusColor(order.status)} size="sm">
                          {getStatusText(order.status)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">路線：</span>
                        {order.pickup} → {order.dropoff}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">司機：</span>
                        {order.driverName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatCurrency(order.estimatedPrice)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.id.slice(-8)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {orders.length > 10 && (
                  <div className="text-center pt-4">
                    <p className="text-sm text-muted-foreground">
                      顯示最近 10 筆記錄，共 {orders.length} 筆
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <History className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  您還沒有任何訂單記錄
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  使用叫車功能後，記錄將會顯示在這裡
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PassengerDashboard;
