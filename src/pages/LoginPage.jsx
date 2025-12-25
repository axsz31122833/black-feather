import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';
import { Phone, UserPlus, User, Car, Shield } from 'lucide-react';
import invokeWithAuth from '../lib/functions';
import taxiApi from '../lib/taxi-api-client';
// 已�����09�x+� 碼�"��&��:Firebase OTP �&保�""��可選�"援
import ensureFirebase, { createRecaptcha, sendFirebaseOtp } from '../lib/firebase';

function LoginPage() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('passenger');
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [needVerification, setNeedVerification] = useState(false); // OTP �"援
  const [verificationCode, setVerificationCode] = useState('');    // OTP �"援
  const [confirmation, setConfirmation] = useState(null);          // OTP �"援
  const { loginUser } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      toast({
        title: '輸�&��R�誤',
        description: '�9輸�&��09�x�"x碼',
        variant: 'destructive'
      });
      return;
    }
    if (!password.trim()) {
      toast({
        title: '輸�&��R�誤',
        description: '�9輸�&�� 碼',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    
    try {
      // �����09�x+� 碼�"��&�
      const data = await invokeWithAuth('phone-login-pwd', { phone, password, role, name, remember });

      if (data?.success) {
        const userData = data.data;
        if (userData?.token) {
          try {
            localStorage.setItem('bf_auth_token', userData.token);
            // 保��使���&快�&�以便�Ʒ���R��}x
            localStorage.setItem('bf_user_profile', JSON.stringify({
              userId: userData.userId,
              phone: userData.phone,
              name: userData.name,
              role: userData.role,
              permissions: userData.permissions
            }));
          } catch (e) {
            console.warn('���� JWT 失�":', e);
          }
        }
        await loginUser(userData);
        
        toast({
          title: '�"��&��Ɛ�`x',
          description: `歡�}�:~� �R${userData.name}！`,
          variant: 'default'
        });
        
        // 根�a�`�"��}��R預設鬲�&��!�身頁面�:�9��S0��客�`�"��0!蒽鬲�&���客頁
        const p = userData.permissions;
        if (userData.role === 'admin' && p?.can_access_admin) {
          navigate('/admin');
        } else if (userData.role === 'driver' && p?.can_access_driver) {
          navigate('/driver');
        } else if (p?.can_access_passenger || userData.role === 'passenger') {
          navigate('/passenger');
        } else {
          navigate('/login');
        }
      } else {
        const msg = data?.error?.message || '�"��&�失�"';
        throw new Error(msg);
      }
    } catch (error) {
      toast({ title: '�"��&�失�"', description: error.message || '�9檢�x����a�09�x�"x碼���&��R�Ɛ註� `', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  // LINE �"��&�已移�"�

  // 移�"�測試模式�R�����Sx�"��&�流�9

  const handleVerifyThenLogin = async () => {
    if (!verificationCode.trim()) {
      toast({ title: '缺���0碼', description: '�9輸�&� 6 位�"���0碼', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      if (!confirmation) throw new Error('缺�確認�S�話�R�9�&��"�鬁��0碼');
      await confirmation.confirm(verificationCode);
      // �"��已��0��Edge Function ���S��S�端�~�0
      let verifiedOk = false;
      try {
        const vRes = await invokeWithAuth('verify-firebase', { phone, role, name });
        verifiedOk = !!vRes?.success;
      } catch (_) {
        const api = (await import('../lib/api')).default;
        const res = await api.post('/auth/verify-firebase', { phone });
        verifiedOk = !!res?.data?.success;
      }
      if (!verifiedOk) throw new Error('�"����0�9��&9失�"');
      const loginRes = await invokeWithAuth('phone-login-pwd', { phone, password, role, name, remember });
      if (!loginRes?.success) throw new Error(loginRes?.error?.message || '�"��&�失�"');
      const userData = loginRes.data;
      if (userData?.token) {
        localStorage.setItem('bf_auth_token', userData.token);
        localStorage.setItem('bf_user_profile', JSON.stringify({ userId: userData.userId, phone: userData.phone, name: userData.name, role: userData.role, permissions: userData.permissions }));
      }
      await loginUser(userData);
      const p = userData.permissions;
      if (userData.role === 'admin' && p?.can_access_admin) navigate('/admin');
      else if (userData.role === 'driver' && p?.can_access_driver) navigate('/driver');
      else navigate('/passenger');
    } catch (error) {
      toast({ title: '��0���"��&�失�"', description: error.message || '�9稍�R� �試', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      ensureFirebase();
      const verifier = createRecaptcha('firebase-recaptcha');
      const res = await sendFirebaseOtp(phone, verifier);
      setConfirmation(res);
      toast({ title: '已�!����0碼', description: '已鬏�} Firebase �!�� OTP', variant: 'default' });
    } catch (error) {
      toast({ title: '�!��失�"', description: error.message || '�9稍�R� �試', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* 主�"�R */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Black Feather 車隊管理系統</h1>
          <p className="text-gray-300">智慧車隊調度與叫車平台</p>
        </div>

        <div className="w-full max-w-md mx-auto">
          {/* �"��&�表�� */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  系统登录
              </CardTitle>
              <CardDescription>
                  请输入您的手机号与密码以登录系统
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Input
                    type="tel"
                      placeholder="请输入 6 位验证码"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-background/50"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Input
                    type="password"
                      placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/50"
                    disabled={loading}
                  />
                </div>
                <div>
                    <label className="block text-sm mb-2">角色</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full p-2 rounded bg-background/50 border border-input"
                    disabled={loading}
                  >
                      <option value="passenger">乘客</option>
                      <option value="driver">司机</option>
                      <option value="admin">管理员</option>
                  </select>
                </div>
              <div className="flex items-center mb-2">
                <input id="remember" type="checkbox" className="mr-2" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={loading} />
                  <label htmlFor="remember" className="text-sm">记住我（此设备）</label>
              </div>
              <Button 
                type="submit" 
                className="w-full btn-primary"
                disabled={loading}
              >
                  {loading ? '登录中...' : '登录系统'}
              </Button>
              {needVerification && (
                <div className="mt-4 space-y-2">
                  <Input
                    type="text"
                    placeholder="�9輸�&� 6 位�"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="bg-background/50"
                    disabled={loading}
                  />
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleVerifyThenLogin} disabled={loading} className="btn-primary">提交��0碼並�"��&�</Button>
                    <Button type="button" onClick={handleResendOtp} disabled={loading} variant="secondary">�!����0碼</Button>
                  </div>
                </div>
              )}
                {/* LINE �"��&�已移�"� */}
              </form>

              {/* Firebase reCAPTCHA 容�"����&�S��S�要 OTP �"援�"使���0 */}
              <div id="firebase-recaptcha" className="mt-2" />

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  ���S0帳�"x�x 
                  <button 
                    onClick={() => navigate('/register')}
                    className="text-primary hover:underline font-medium"
                  >
                    �9即註� `
                  </button>
                </p>
              </div>

              {/* �&��"��&�測試模式�a快�x�"��&���測試��客��司�x */}
              <div className="mt-6 grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  className="w-full bg-blue-600 text-white"
                  onClick={() => {
                    const guest = {
                      userId: 'test_passenger',
                      role: 'passenger',
                      name: import.meta.env.VITE_DEV_USER_NAME || '測試乘客',
                      phone: import.meta.env.VITE_DEV_USER_PHONE || '0912345678',
                      permissions: { can_access_passenger: true }
                    };
                    loginUser(guest);
                    navigate('/passenger');
                  }}
                >
                  以測試乘客登入</Button>
                <Button
                  type="button"
                  className="w-full bg-green-600 text-white"
                  onClick={() => {
                    const guest = {
                      userId: 'test_driver',
                      role: 'driver',
                      name: '測試司機',
                      phone: import.meta.env.VITE_DEV_DRIVER_PHONE || '090000001',
                      permissions: { can_access_driver: true }
                    };
                    loginUser(guest);
                    navigate('/driver');
                  }}
                >
                  以測試司機登入</Button>
              </div>

              {/* 已移�"� LINE �"��&��R�9使���09�x�"��&� */}
            </CardContent>
          </Card>

          
        </div>


      </div>
    </div>
  );
}

export default LoginPage;
