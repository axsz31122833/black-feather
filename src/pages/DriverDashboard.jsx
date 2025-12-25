import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import { formatDate, formatCurrency, getStatusColor, getStatusText } from '../lib/utils';
import { 
  Car, 
  MapPin, 
  Navigation, 
  Clock, 
  User, 
  LogOut,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Phone,
  Activity,
  History,
  Star
} from 'lucide-react';
import invokeWithAuth from '../lib/functions';
import taxiApi from '../lib/taxi-api-client';
import OSMMap from '../components/OSMMap';
import { useWs } from '../contexts/WsContext';

function DriverDashboard() {
  const { 
    user, 
    orders, 
    loading, 
    updateDriverStatus, 
    completeRide, 
    loadOrders, 
    logout 
  } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [onlineAt, setOnlineAt] = useState(null);
  const [ratingAvg, setRatingAvg] = useState(null);
  const [reviewCount, setReviewCount] = useState(null);
  const heartbeatTimer = useRef(null);
  // WebSocket integration
  const { online, setOnline, lastLocation, startMeter } = useWs();

  useEffect(() => {
    if (user?.phone) {
      loadOrders(user.phone);
      // è®¬ï¿½å¸ï¿½xï¿½"ï¿½ï¿½ ï¿½ï¿½!çµ±ï¿½ï¿½
      (async () => {
        try {
          const profile = await taxiApi.getUserProfile(user.phone);
          setRatingAvg(profile?.rating_avg ?? null);
          setReviewCount(profile?.review_count ?? null);
        } catch (err) {
          console.warn('è®¬ï¿½å¸ï¿½xï¿½!ï¿½"å¤±ï¿½"', err);
        }
      })();
    }
  }, [user]);

  // ï¿½ï¿½ GPS ä¸¦å¿’è·³ï¿½`å ±
  useEffect(() => {
    const updateLocation = () => {
      if (!('geolocation' in navigator)) {
        toast({ title: 'ï¿½aä½ä¸ï¿½ï¿½æ´', description: 'æ­¤è£ç½®ä¸ï¿½ï¿½æ´ï¿½aä½ï¿½`xè’½', variant: 'destructive' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude, heading, speed } = pos.coords;
          setCoords({ lat: latitude, lng: longitude });
          try {
            const res = await invokeWithAuth('driver-heartbeat', {
              phone: user?.phone,
              status: user?.status || null,
              lat: latitude,
              lng: longitude,
              heading,
              speed
            });
            if (res?.success) {
              setOnlineAt(res.data?.lastOnlineAt || null);
              // å¯é¸ï¿½aï¿½:ï¿½ï¿½ï¿½ AppContext å¸ï¿½xï¿½9ï¿½ï¿½&9ï¿½ï¿½ï¿½"ï¿½ï¿½0
              console.debug('Heartbeat OK', res.data);
            } else {
              console.warn('Heartbeat failed', res);
            }
          } catch (err) {
            console.error('Heartbeat error', err);
          }
        },
        (err) => {
          console.error('Geolocation error', err);
          toast({ title: 'ï¿½aä½å¤±ï¿½"', description: err.message, variant: 'destructive' });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    };

    // ï¿½æ¬¡ï¿½9å³ï¿½:ï¿½ï¿½ï¿½
    updateLocation();
    // æ¯ 20 ï¿½å¿’è·³
    heartbeatTimer.current = setInterval(updateLocation, 20000);

    return () => {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    };
  }, [user]);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await updateDriverStatus(user.phone, newStatus);
      toast({
        title: 'ï¿½9ï¿½ï¿½&9å·²ï¿½:ï¿½ï¿½ï¿½',
        description: `ï¿½ï¿½ï¿½aï¿½9ï¿½ï¿½&9å·²è¨­ï¿½ï¿½: ${getStatusText(newStatus)}`,
        variant: 'success'
      });
    } catch (error) {
      toast({
        title: 'ï¿½9ï¿½ï¿½&9ï¿½:ï¿½ï¿½ï¿½å¤±ï¿½"',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleCompleteRide = async (orderId) => {
    setUpdating(true);
    try {
      await completeRide(orderId, user.phone);
      toast({
        title: 'ï¿½ï¿½ï¿½å·²ï¿½Rï¿½Æ',
        description: 'ï¿½ï¿½å·²ï¿½Æï¿½`xï¿½Rï¿½Æï¿½"ï¿½9ï¿½ï¿½ï¿½',
        variant: 'success'
      });
      // ï¿½!ï¿½ï¿½ï¿½ï¿½`ï¿½ï¿½0ï¿½ï¿½ï¿½
      loadOrders(user.phone);

      // æç¤ºå¸ï¿½xï¿½"ï¿½ï¿½ ï¿½ï¿½1-5 ï¿½ï¿½xï¿½0ï¿½Rç°¡ï¿½ï¿½æµï¿½9ï¿½aä½¿ï¿½ï¿½ promptï¿½:ï¿½9ï¿½Rå¯ï¿½ï¿½ï¿½ï¿½ï¿½:ï¿½ï¿½}ï¿½aå°è©±ï¿½ 
      const raw = window.prompt('ï¿½9ï¿½ï¿½ï¿½Sï¿½æ¬¡ï¿½Sï¿½ï¿½9"ï¿½"ï¿½ï¿½ ï¿½ï¿½1-5ï¿½0ï¿½a', '5');
      const rating = Number(raw);
      if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
        try {
          await taxiApi.submitOrderReview({ orderId, rating, comment: '', byPhone: user.phone });
          toast({ title: 'ï¿½"å’¹å·²é¬ï¿½!ï¿½', description: `è¬è¬ï¼ï¿½Sï¿½æ¬¡ï¿½"ï¿½ï¿½ ï¿½a${rating} ï¿½ï¿½x`, variant: 'success' });
          try {
            const profile = await taxiApi.getUserProfile(user.phone);
            setRatingAvg(profile?.rating_avg ?? null);
            setReviewCount(profile?.review_count ?? null);
          } catch (_) {}
        } catch (err) {
          console.error('æäº¤ï¿½"å’¹å¤±ï¿½"', err);
          toast({ title: 'æäº¤ï¿½"å’¹å¤±ï¿½"', description: String(err?.message || err), variant: 'destructive' });
        }
      }
    } catch (error) {
      toast({
        title: 'ï¿½Rï¿½Æï¿½ï¿½ï¿½å¤±ï¿½"',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    toast({
      title: 'ï¿½ï¿½å·²ï¿½"ï¿½ï¿½!ï¿½ï¿½Rï¿½ï¿½:~ä¸»ï¿½"ï¿½é¢ä¸­...',
      description: 'è¬è¬ï¿½ï¿½ï¿½aï¿½Sï¿½ï¿½9"ï¼',
      variant: 'success'
    });
    setTimeout(() => {
      try { navigate('/'); } catch (_) { window.location.href = '/'; }
    }, 1500);
  };

  const handleRefresh = () => {
    loadOrders(user.phone);
    toast({
      title: 'å·²ï¿½:ï¿½ï¿½ï¿½',
      description: 'ï¿½ï¿½ï¿½ï¿½!ï¿½"å·²ï¿½:ï¿½ï¿½ï¿½',
      variant: 'success'
    });
  };

  // ä»¥ requested ï¿½Sï¿½ï¿½ï¿½&æ´¾ï¿½`ï¿½Rï¿½9ï¿½æµï¿½9å« assigned/accepted å¯å¦ï¿½Rï¿½ï¿½ï¿½&&çµ±ï¿½ï¿½
  // ï¿½ï¿½ï¿½é¬²ï¿½Rä¸­ï¿½aï¿½9ï¿½ï¿½&9ï¿½arequested/pending/accepted/enroute/arrived
  const pendingOrders = orders.filter(order => ['requested','pending','accepted','enroute','arrived'].includes(order.status));
  const completedOrders = orders.filter(order => order.status === 'completed');
  const totalEarnings = completedOrders.reduce((sum, order) => sum + (order.estimatedPrice || 0), 0);

  // ï¿½"ï¿½ï¿½0ï¿½ï¿½ï¿½ï¿½ï¿½aåº§ï¿½"ï¿½ï¿½ï¿½9ï¿½ï¿½ï¿½ï¿½Sï¿½ï¿½0
  const currentPending = pendingOrders[0] || null;
  const pickupCoord = (currentPending?.pickupLat && currentPending?.pickupLng)
    ? { lat: currentPending.pickupLat, lng: currentPending.pickupLng }
    : null;
  const dropoffCoord = (currentPending?.dropoffLat && currentPending?.dropoffLng)
    ? { lat: currentPending.dropoffLat, lng: currentPending.dropoffLng }
    : null;
  const mapCenter = (coords.lat && coords.lng)
    ? { lat: coords.lat, lng: coords.lng }
    : (pickupCoord || { lat: 25.033964, lng: 121.564468 });

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* ï¿½"ï¿½Rï¿½ï¿½ */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              å¸ï¿½xä¸­å¿’
            </h1>
            <p className="text-gray-300">
              æ­¡ï¿½}ï¿½R{user?.name} ï¿½ï¿½{user?.phone}ï¿½0
            </p>
          </div>
          <div className="flex gap-2">
          {/* WebSocket: online toggle */}
          <Button variant={online ? 'secondary' : 'default'} onClick={() => setOnline(!online)}>{online ? '下線' : '上線'}</Button>
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              ï¿½:ï¿½ï¿½ï¿½
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              ï¿½"ï¿½ï¿½!ï¿½
            </Button>
          </div>
        </div>

        {/* çµ±ï¿½ï¿½ï¿½!ï¿½` */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">ï¿½:ï¿½ï¿½0ï¿½ï¿½9ï¿½ï¿½&9</p>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(user?.status || 'offline')}>
                      {getStatusText(user?.status || 'offline')}
                    </Badge>
                    {onlineAt && (
                      <span className="text-xs text-muted-foreground">ï¿½Sï¿½ï¿½å¿’è·³ï¿½a{new Date(onlineAt).toLocaleTimeString()}</span>
                    )}
                    {(ratingAvg !== null) && (
                      <span className="flex items-center gap-1 ml-2 text-xs text-yellow-400">
                        <Star className="w-4 h-4" />
                        {ratingAvg} {reviewCount ? `(${reviewCount})` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">é¬²ï¿½Rä¸­</p>
                  <p className="text-xl font-bold">{pendingOrders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">å·²ï¿½Rï¿½Æ</p>
                  <p className="text-xl font-bold">{completedOrders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Car className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">ç¸½ï¿½ï¿½ï¿½&ï¿½</p>
                  <p className="text-xl font-bold text-green-400">
                    {formatCurrency(totalEarnings)}
                  </p>
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>ï¿½:ï¿½ï¿½0ï¿½åº§ï¿½"ï¿½a</span>
                    <span>{coords.lat ? coords.lat.toFixed(6) : '-'}, {coords.lng ? coords.lng.toFixed(6) : '-'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* å¸¸é§ï¿½Sï¿½ï¿½S */}
        <Card className="glass card-hover mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              å³ï¿½"ï¿½Sï¿½ï¿½S
            </CardTitle>
            <CardDescription>  {pendingOrders.length > 0 ? "你有待處理的訂單，請盡快處理" : "目前沒有待處理訂單"} </CardDescription>
            </CardHeader>
          <CardContent>
            {pendingOrders.length > 0 ? (
              <div className="space-y-4">
                {pendingOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-background/20 rounded-lg border border-border/50">
                    <div>
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusText(order.status)}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">Order # {order.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-400">{formatCurrency(order.estimatedPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Car className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pending orders</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DriverDashboard;



