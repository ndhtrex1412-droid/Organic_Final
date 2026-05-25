import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import '@/App.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Package, MessageSquare, LogOut, Plus, Edit, Trash2, Send, Loader2, ShoppingCart, Home, Mail, User, Phone, MapPin, CreditCard, Minus, Search, Copy, ChevronLeft, ChevronRight, Keyboard, Camera, Upload, Download, FileJson, FileSpreadsheet, CheckSquare, Square, ArrowLeft, Bot, Eye, EyeOff } from 'lucide-react';
import vnProvinces from './lib/vn-provinces.json';
import { Checkbox } from '@/components/ui/checkbox';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const formatVND = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0
  }).format(amount);
};

const AuthContext = createContext(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const AuthProvider = ({ children }) => {
  // NOTE on storage: This app currently persists the auth token in localStorage.
  // Tokens in localStorage are readable by any JS running on the page and are
  // therefore vulnerable to XSS. A more secure approach is to issue httpOnly,
  // Secure, SameSite cookies from the backend so JS can never read the token.
  // The migration requires backend changes (cookie issuance + CSRF protection)
  // and is tracked as a follow-up. Until then, the app relies on CSP / input
  // sanitization / dependency hygiene as its XSS defense.
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true');

  const login = (newToken, userData, admin = false) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('isAdmin', admin.toString());
    setToken(newToken);
    setUser(userData);
    setIsAdmin(admin);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isAdmin');
    setToken(null);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ token, user, isAdmin, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
};

const ITEMS_PER_PAGE = 8;

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailQty, setDetailQty] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();
  const productGridRef = React.useRef(null);

  useEffect(() => {
    let alive = true;
    const fetchProducts = async (isFirst) => {
      try {
        const response = await axios.get(`${API}/products`);
        if (!alive) return;
        setProducts(response.data);
        if (isFirst) {
          const initQty = {};
          response.data.forEach(p => { initQty[p.ProductID] = 1; });
          setQuantities(initQty);
        } else {
          setQuantities(prev => {
            const next = { ...prev };
            response.data.forEach(p => { if (next[p.ProductID] == null) next[p.ProductID] = 1; });
            return next;
          });
        }
      } catch (error) {
        if (isFirst) toast.error('Không thể tải sản phẩm');
      } finally {
        if (isFirst && alive) setLoading(false);
      }
    };
    fetchProducts(true);
    const interval = setInterval(() => fetchProducts(false), 5000);
    return () => { alive = false; clearInterval(interval); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- API/axios are module constants; poll on mount only

  const updateQty = (productId, delta) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta)
    }));
  };

  const addToCart = async (productId, qty) => {
    if (!token) {
      toast.error('Vui lòng đăng nhập để mua hàng');
      navigate('/login');
      return;
    }
    try {
      await axios.post(`${API}/cart/add`, { product_id: productId, quantity: qty || quantities[productId] || 1 }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Đã thêm ${qty || quantities[productId] || 1} sản phẩm vào giỏ hàng`);
      setQuantities(prev => ({ ...prev, [productId]: 1 }));
    } catch (error) {
      toast.error('Không thể thêm vào giỏ hàng');
    }
  };

  const openDetail = (product) => {
    setSelectedProduct(product);
    setDetailQty(1);
  };

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  const paginatedProducts = products.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const goToPage = (page) => {
    setCurrentPage(page);
    productGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6]">
      <nav className="bg-white border-b border-[#E3E8E0] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <img src="https://images.unsplash.com/photo-1587334274328-64186a80aeee?w=100" alt="Logo" className="h-10 w-10 rounded-full" />
            <span className="text-xl font-semibold text-[#1A2118]">Cửa Hàng Hữu Cơ</span>
          </Link>
          <div className="flex gap-4 items-center">
            <Link to="/" className="text-[#5C6656] hover:text-[#2C5F2D]"><Home size={20} /></Link>
            <Link to="/contact" className="text-[#5C6656] hover:text-[#2C5F2D]"><Mail size={20} /></Link>
            {token ? (
              <>
                <Link to="/chat" className="text-[#5C6656] hover:text-[#2C5F2D]"><MessageSquare size={20} /></Link>
                <Link to="/ocr-search" className="text-[#5C6656] hover:text-[#2C5F2D]"><Camera size={20} /></Link>
                {!isAdmin && <Link to="/cart" className="text-[#5C6656] hover:text-[#2C5F2D]"><ShoppingCart size={20} /></Link>}
                {isAdmin && <Link to="/admin/products"><Button size="sm" className="bg-[#2C5F2D]">Quản trị</Button></Link>}
                <Link to="/profile"><User size={20} className="text-[#5C6656]" /></Link>
              </>
            ) : (
              <>
                <Link to="/login"><Button size="sm" variant="outline">Đăng nhập</Button></Link>
                <Link to="/register"><Button size="sm" className="bg-[#2C5F2D]">Đăng ký</Button></Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div ref={productGridRef} className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-8">
          <div>
            <h1 className="text-4xl font-semibold text-[#1A2118] mb-1">Sản Phẩm Hữu Cơ Việt Nam</h1>
            <p className="text-[#5C6656]">Tươi ngon, an toàn, đạt chuẩn VietGAP</p>
          </div>
          {!loading && products.length > 0 && (
            <p className="text-sm text-[#5C6656] shrink-0">
              Hiển thị <span className="font-semibold text-[#1A2118]">{(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, products.length)}</span> / {products.length} sản phẩm
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12"><Loader2 className="animate-spin mx-auto" size={32} /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {paginatedProducts.map((product) => (
                <Card key={product.ProductID} className="hover:shadow-lg transition-all group cursor-pointer" onClick={() => openDetail(product)}>
                  <div className="relative overflow-hidden rounded-t-xl">
                    <img src={product.PathImage} alt={product.ProductName} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-[#2C5F2D] text-xs font-semibold px-3 py-1 rounded-full">Xem chi tiết</span>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-[#1A2118] mb-1 line-clamp-1">{product.ProductName}</h3>
                    <p className="text-sm text-[#5C6656] mb-2">{product.ProductType}</p>
                    <p className="text-lg font-bold text-[#2C5F2D] mb-3">{formatVND(product.Price)}</p>
                    <div className="flex items-center gap-2 mb-3" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => updateQty(product.ProductID, -1)} disabled={(quantities[product.ProductID] || 1) <= 1} className="h-8 w-8 p-0" data-testid={`qty-decrease-${product.ProductID}`}><Minus size={14} /></Button>
                      <span className="w-8 text-center font-medium text-[#1A2118]" data-testid={`qty-display-${product.ProductID}`}>{quantities[product.ProductID] || 1}</span>
                      <Button size="sm" variant="outline" onClick={() => updateQty(product.ProductID, 1)} className="h-8 w-8 p-0" data-testid={`qty-increase-${product.ProductID}`}><Plus size={14} /></Button>
                    </div>
                    <Button onClick={(e) => { e.stopPropagation(); addToCart(product.ProductID); }} className="w-full bg-[#2C5F2D] hover:bg-[#1E441F]" data-testid={`add-to-cart-${product.ProductID}`}>
                      <ShoppingCart size={16} className="mr-2" />Thêm vào giỏ
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg border border-[#E3E8E0] text-sm font-medium text-[#5C6656] hover:border-[#2C5F2D] hover:text-[#2C5F2D] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  data-testid="pagination-prev"
                >
                  <ChevronLeft size={16} />Trước
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  const isActive = page === currentPage;
                  const showPage = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                  const showEllipsisBefore = page === currentPage - 2 && page > 2;
                  const showEllipsisAfter = page === currentPage + 2 && page < totalPages - 1;
                  if (showEllipsisBefore || showEllipsisAfter) {
                    return <span key={`ellipsis-${page}`} className="px-1 text-[#5C6656]">…</span>;
                  }
                  if (!showPage) return null;
                  return (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all border ${
                        isActive
                          ? 'bg-[#2C5F2D] text-white border-[#2C5F2D] shadow-md scale-105'
                          : 'border-[#E3E8E0] text-[#5C6656] hover:border-[#2C5F2D] hover:text-[#2C5F2D]'
                      }`}
                      data-testid={`pagination-page-${page}`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg border border-[#E3E8E0] text-sm font-medium text-[#5C6656] hover:border-[#2C5F2D] hover:text-[#2C5F2D] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  data-testid="pagination-next"
                >
                  Sau<ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {selectedProduct && (
            <div className="flex flex-col md:flex-row">
              {/* Left: image */}
              <div className="md:w-2/5 relative">
                <img src={selectedProduct.PathImage} alt={selectedProduct.ProductName} className="w-full h-64 md:h-full object-cover" />
                <span className="absolute top-3 left-3 bg-[#2C5F2D] text-white text-xs font-bold px-3 py-1 rounded-full">{selectedProduct.ProductType}</span>
              </div>
              {/* Right: info */}
              <div className="md:w-3/5 p-6 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
                <div>
                  <h2 className="text-2xl font-bold text-[#1A2118] mb-1">{selectedProduct.ProductName}</h2>
                  <p className="text-2xl font-bold text-[#2C5F2D]">{formatVND(selectedProduct.Price)}<span className="text-sm font-normal text-[#5C6656] ml-1">/ {selectedProduct.Unit}</span></p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedProduct.Origin && (
                    <div className="bg-[#F0F4EE] rounded-lg p-3">
                      <p className="text-[#5C6656] text-xs mb-1">Xuất xứ</p>
                      <p className="font-semibold text-[#1A2118]">{selectedProduct.Origin}</p>
                    </div>
                  )}
                  <div className="bg-[#F0F4EE] rounded-lg p-3">
                    <p className="text-[#5C6656] text-xs mb-1">Số lượng còn</p>
                    <p className="font-semibold text-[#1A2118]">{selectedProduct.Quantity} {selectedProduct.Unit}</p>
                  </div>
                  {selectedProduct.Certification && (
                    <div className="bg-green-50 rounded-lg p-3 col-span-2">
                      <p className="text-[#5C6656] text-xs mb-1">✅ Chứng nhận</p>
                      <p className="font-semibold text-[#2C5F2D]">{selectedProduct.Certification}</p>
                    </div>
                  )}
                </div>

                {selectedProduct.Description && (
                  <div>
                    <p className="text-sm font-semibold text-[#1A2118] mb-1">Mô tả sản phẩm</p>
                    <p className="text-sm text-[#5C6656] leading-relaxed">{selectedProduct.Description}</p>
                  </div>
                )}

                {!isAdmin && (
                  <div className="mt-auto pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-sm font-medium text-[#1A2118]">Số lượng:</span>
                      <Button size="sm" variant="outline" onClick={() => setDetailQty(q => Math.max(1, q - 1))} className="h-9 w-9 p-0"><Minus size={14} /></Button>
                      <span className="w-10 text-center font-bold text-lg">{detailQty}</span>
                      <Button size="sm" variant="outline" onClick={() => setDetailQty(q => q + 1)} className="h-9 w-9 p-0"><Plus size={14} /></Button>
                    </div>
                    <Button
                      className="w-full bg-[#2C5F2D] hover:bg-[#1E441F] h-12 text-base font-semibold"
                      onClick={() => { addToCart(selectedProduct.ProductID, detailQty); setSelectedProduct(null); }}
                    >
                      <ShoppingCart size={18} className="mr-2" />
                      Thêm {detailQty} vào giỏ hàng &mdash; {formatVND(selectedProduct.Price * detailQty)}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!email) newErrors.email = 'Vui lòng nhập email hoặc tên đăng nhập';
    if (!password) newErrors.password = 'Vui lòng nhập mật khẩu';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      const endpoint = isAdminLogin ? '/auth/login' : '/users/login';
      const payload = isAdminLogin ? { username: email, password } : { email, password };
      const response = await axios.post(`${API}${endpoint}`, payload);
      
      const userData = isAdminLogin 
        ? { username: response.data.username } 
        : { email: response.data.email, full_name: response.data.full_name };
      
      login(response.data.token, userData, isAdminLogin);
      toast.success('Đăng nhập thành công!');
      navigate(isAdminLogin ? '/admin/products' : '/');
    } catch (error) {
      setErrors({ submit: error.response?.data?.detail || 'Đăng nhập thất bại' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="https://images.unsplash.com/photo-1587334274328-64186a80aeee?w=100" alt="Logo" className="h-16 w-16 rounded-full mx-auto mb-4" />
          <CardTitle className="text-2xl">{isAdminLogin ? 'Đăng Nhập Quản Trị' : 'Đăng Nhập'}</CardTitle>
          <CardDescription>Cửa Hàng Thực Phẩm Hữu Cơ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email">{isAdminLogin ? 'Tên đăng nhập' : 'Email'}</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`mt-1.5 ${errors.email ? 'border-red-500' : ''}`}
                placeholder={isAdminLogin ? 'Nhập tên đăng nhập' : 'Nhập email'}
                data-testid="login-email-input"
              />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="password">Mật khẩu</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  placeholder="Nhập mật khẩu"
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-[#5C6656] hover:text-[#2C5F2D]"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
            </div>
            {!isAdminLogin && (
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm text-[#2C5F2D] hover:underline" data-testid="forgot-password-link">
                  Quên mật khẩu?
                </Link>
              </div>
            )}
            {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
            <Button type="submit" className="w-full bg-[#2C5F2D]" disabled={loading} data-testid="login-submit-button">
              {loading ? <Loader2 className="animate-spin" /> : 'Đăng Nhập'}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            <button onClick={() => setIsAdminLogin(!isAdminLogin)} className="text-sm text-[#2C5F2D] hover:underline">
              {isAdminLogin ? 'Đăng nhập khách hàng' : 'Đăng nhập quản trị viên'}
            </button>
            <p className="text-sm text-[#5C6656]">
              Chưa có tài khoản? <Link to="/register" className="text-[#2C5F2D] hover:underline">Đăng ký ngay</Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ForgotPasswordPage = () => {
  const [formData, setFormData] = useState({ email: '', phone: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Vui lòng nhập email';
    if (!formData.phone) newErrors.phone = 'Vui lòng nhập số điện thoại';
    if (!formData.newPassword) newErrors.newPassword = 'Vui lòng nhập mật khẩu mới';
    else if (formData.newPassword.length < 6) newErrors.newPassword = 'Mật khẩu phải có ít nhất 6 ký tự';
    if (formData.newPassword !== formData.confirmPassword) newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await axios.post(`${API}/users/reset-password`, {
        email: formData.email,
        phone: formData.phone,
        new_password: formData.newPassword
      });
      toast.success('Đổi mật khẩu thành công! Bạn có thể đăng nhập ngay bây giờ.');
      navigate('/login');
    } catch (error) {
      setErrors({ submit: error.response?.data?.detail || 'Đổi mật khẩu thất bại' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Quên Mật Khẩu</CardTitle>
          <CardDescription>Xác minh danh tính để đặt lại mật khẩu</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="forgot-password-form">
            <div>
              <Label htmlFor="email">Email đã đăng ký</Label>
              <Input
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className={`mt-1.5 ${errors.email ? 'border-red-500' : ''}`}
                placeholder="Nhập email"
                data-testid="forgot-password-email"
              />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className={`mt-1.5 ${errors.phone ? 'border-red-500' : ''}`}
                placeholder="Nhập số điện thoại"
                data-testid="forgot-password-phone"
              />
              {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                className={`mt-1.5 ${errors.newPassword ? 'border-red-500' : ''}`}
                placeholder="Nhập mật khẩu mới"
                data-testid="forgot-password-new"
              />
              {errors.newPassword && <p className="text-sm text-red-500 mt-1">{errors.newPassword}</p>}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                className={`mt-1.5 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                placeholder="Nhập lại mật khẩu mới"
                data-testid="forgot-password-confirm"
              />
              {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>}
            </div>
            {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
            <Button type="submit" className="w-full bg-[#2C5F2D]" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Đặt Lại Mật Khẩu'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-[#2C5F2D] hover:underline">
              Quay lại Đăng nhập
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    full_name: '', email: '', phone: '', password: '', confirmPassword: '',
    address: '', province: '', district: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const provinces = vnProvinces;
  const districtsForSelected = React.useMemo(() => {
    const found = vnProvinces.find(p => p.name === formData.province);
    return found ? found.districts : [];
  }, [formData.province]);

  const validate = () => {
    const newErrors = {};
    if (!formData.full_name) newErrors.full_name = 'Vui lòng nhập họ tên';
    if (!formData.email) newErrors.email = 'Vui lòng nhập email';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email không hợp lệ';
    if (!formData.phone) newErrors.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^[0-9]{10}$/.test(formData.phone)) newErrors.phone = 'Số điện thoại phải có 10 chữ số';
    if (!formData.password) newErrors.password = 'Vui lòng nhập mật khẩu';
    else if (formData.password.length < 6) newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Mật khẩu không khớp';
    if (!formData.address) newErrors.address = 'Vui lòng nhập địa chỉ';
    if (!formData.province) newErrors.province = 'Vui lòng chọn tỉnh/thành phố';
    if (!formData.district) newErrors.district = 'Vui lòng nhập quận/huyện';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { confirmPassword, ...registerData } = formData;
      const response = await axios.post(`${API}/users/register`, registerData);
      login(response.data.token, { email: response.data.email, full_name: response.data.full_name }, false);
      toast.success('Đăng ký thành công!');
      navigate('/');
    } catch (error) {
      setErrors({ submit: error.response?.data?.detail || 'Đăng ký thất bại' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] py-8 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Đăng Ký Tài Khoản</CardTitle>
          <CardDescription className="text-center">Tạo tài khoản để mua sắm tại cửa hàng hữu cơ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Họ và tên <span className="text-red-500">*</span></Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className={`mt-1.5 ${errors.full_name ? 'border-red-500' : ''}`}
                  placeholder="Nguyễn Văn A"
                  data-testid="register-fullname-input"
                />
                {errors.full_name && <p className="text-sm text-red-500 mt-1">{errors.full_name}</p>}
              </div>
              <div>
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`mt-1.5 ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="email@example.com"
                  data-testid="register-email-input"
                />
                {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Số điện thoại <span className="text-red-500">*</span></Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className={`mt-1.5 ${errors.phone ? 'border-red-500' : ''}`}
                  placeholder="0912345678"
                  data-testid="register-phone-input"
                />
                {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div>
                <Label htmlFor="password">Mật khẩu <span className="text-red-500">*</span></Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className={`mt-1.5 ${errors.password ? 'border-red-500' : ''}`}
                  placeholder="Tối thiểu 6 ký tự"
                  data-testid="register-password-input"
                />
                {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="confirmPassword">Xác nhận mật khẩu <span className="text-red-500">*</span></Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className={`mt-1.5 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  placeholder="Nhập lại mật khẩu"
                  data-testid="register-confirm-password-input"
                />
                {errors.confirmPassword && <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address">Địa chỉ <span className="text-red-500">*</span></Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className={`mt-1.5 ${errors.address ? 'border-red-500' : ''}`}
                  placeholder="123 Đường ABC, Phường XYZ"
                  data-testid="register-address-input"
                />
                {errors.address && <p className="text-sm text-red-500 mt-1">{errors.address}</p>}
              </div>
              <div>
                <Label htmlFor="province">Tỉnh/Thành phố <span className="text-red-500">*</span></Label>
                <Select value={formData.province} onValueChange={(value) => setFormData({...formData, province: value, district: ''})}>
                  <SelectTrigger className={`mt-1.5 ${errors.province ? 'border-red-500' : ''}`} data-testid="register-province-select">
                    <SelectValue placeholder="Chọn tỉnh/thành phố" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {provinces.map(p => <SelectItem key={p.code} value={p.name}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.province && <p className="text-sm text-red-500 mt-1">{errors.province}</p>}
              </div>
              <div>
                <Label htmlFor="district">Quận/Huyện <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.district}
                  onValueChange={(value) => setFormData({...formData, district: value})}
                  disabled={!formData.province}
                >
                  <SelectTrigger className={`mt-1.5 ${errors.district ? 'border-red-500' : ''}`} data-testid="register-district-select">
                    <SelectValue placeholder={formData.province ? 'Chọn quận/huyện' : 'Chọn tỉnh/thành phố trước'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {districtsForSelected.map(d => <SelectItem key={d.code} value={d.name}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.district && <p className="text-sm text-red-500 mt-1">{errors.district}</p>}
              </div>
            </div>
            {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
            <Button type="submit" className="w-full bg-[#2C5F2D]" disabled={loading} data-testid="register-submit-button">
              {loading ? <Loader2 className="animate-spin" /> : 'Đăng Ký'}
            </Button>
          </form>
          <p className="text-sm text-center mt-4 text-[#5C6656]">
            Đã có tài khoản? <Link to="/login" className="text-[#2C5F2D] hover:underline">Đăng nhập</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const CartPage = () => {
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const navigate = useNavigate();

  const fetchCart = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/cart`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCart(response.data);
    } catch (error) {
      toast.error('Không thể tải giỏ hàng');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCart();
    const interval = setInterval(fetchCart, 5000);
    return () => clearInterval(interval);
  }, [fetchCart]);

  const removeItem = async (productId) => {
    try {
      await axios.delete(`${API}/cart/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Đã xóa khỏi giỏ hàng');
      fetchCart();
    } catch (error) {
      toast.error('Không thể xóa sản phẩm');
    }
  };

  const updateQuantity = async (productId, newQty) => {
    if (newQty < 1) return;
    try {
      await axios.put(`${API}/cart/${productId}`, { quantity: newQty }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCart();
    } catch (error) {
      toast.error('Không thể cập nhật số lượng');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold text-[#1A2118] mb-6">Giỏ Hàng Của Bạn</h1>
        {loading ? (
          <div className="text-center py-12"><Loader2 className="animate-spin mx-auto" size={32} /></div>
        ) : cart.items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingCart className="mx-auto mb-4 text-[#5C6656]" size={48} />
              <p className="text-[#5C6656] mb-4">Giỏ hàng trống</p>
              <Link to="/"><Button className="bg-[#2C5F2D]">Tiếp tục mua sắm</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-6">
                {cart.items.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-4 py-4 border-b last:border-0">
                    <img src={item.image} alt={item.product_name} className="w-20 h-20 object-cover rounded-lg" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#1A2118]">{item.product_name}</h3>
                      <p className="text-[#2C5F2D] font-bold">{formatVND(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => updateQuantity(item.product_id, item.quantity - 1)} disabled={item.quantity <= 1} data-testid={`cart-qty-decrease-${item.product_id}`}>
                        <Minus size={14} />
                      </Button>
                      <span className="w-8 text-center font-medium" data-testid={`cart-qty-${item.product_id}`}>{item.quantity}</span>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => updateQuantity(item.product_id, item.quantity + 1)} data-testid={`cart-qty-increase-${item.product_id}`}>
                        <Plus size={14} />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeItem(item.product_id)}
                      data-testid={`remove-cart-${item.product_id}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <div className="mt-6 pt-6 border-t">
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span>Tổng cộng:</span>
                    <span className="text-[#2C5F2D]">{formatVND(cart.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="mt-6 flex gap-4">
              <Link to="/" className="flex-1"><Button variant="outline" className="w-full">Tiếp tục mua sắm</Button></Link>
              <Link to="/checkout" className="flex-1"><Button className="w-full bg-[#2C5F2D]">Thanh toán</Button></Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const CheckoutPage = () => {
  const [formData, setFormData] = useState({
    full_name: '', phone: '', address: '', province: '', district: '',
    detail_address: '', payment_method: 'cod', notes: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [cartTotal, setCartTotal] = useState(0);
  const { token } = useAuth();
  const navigate = useNavigate();

  const provinces = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng', 'Bình Dương', 'Đồng Nai', 'Huế', 'Nha Trang', 'Vũng Tàu'];

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const res = await axios.get(`${API}/cart`, { headers: { Authorization: `Bearer ${token}` } });
        setCartTotal(res.data.total || 0);
      } catch {}
    };
    fetchCart();
  }, [token]);

  // MB Bank VietQR URL
  const BANK_ID = 'MB';
  const ACCOUNT_NO = '100028062005';
  const ACCOUNT_NAME = 'NGUYEN DUC HOAN';
  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${cartTotal}&addInfo=Thanh%20toan%20don%20hang%20huu%20co&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

  const validate = () => {
    const newErrors = {};
    if (!formData.full_name) newErrors.full_name = 'Vui lòng nhập họ tên';
    if (!formData.phone) newErrors.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^[0-9]{10}$/.test(formData.phone)) newErrors.phone = 'Số điện thoại không hợp lệ';
    if (!formData.address) newErrors.address = 'Vui lòng nhập địa chỉ giao hàng';
    if (!formData.province) newErrors.province = 'Vui lòng chọn tỉnh/thành phố';
    if (!formData.district) newErrors.district = 'Vui lòng nhập quận/huyện';
    if (!formData.detail_address) newErrors.detail_address = 'Vui lòng nhập địa chỉ chi tiết';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const submitData = {
        ...formData,
        address: `${formData.address}, ${formData.detail_address}`
      };
      delete submitData.detail_address;

      await axios.post(`${API}/checkout`, submitData, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Đặt hàng thành công! Cảm ơn bạn đã mua hàng.');
      navigate('/');
    } catch (error) {
      setErrors({ submit: error.response?.data?.detail || 'Đặt hàng thất bại' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Thông Tin Giao Hàng</CardTitle>
            <CardDescription>Vui lòng điền đầy đủ thông tin để hoàn tất đơn hàng</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="checkout-form">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Họ và tên <span className="text-red-500">*</span></Label>
                  <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} className={`mt-1.5 ${errors.full_name ? 'border-red-500' : ''}`} placeholder="Nguyễn Văn A" data-testid="checkout-fullname-input" />
                  {errors.full_name && <p className="text-sm text-red-500 mt-1">{errors.full_name}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">Số điện thoại <span className="text-red-500">*</span></Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className={`mt-1.5 ${errors.phone ? 'border-red-500' : ''}`} placeholder="0912345678" data-testid="checkout-phone-input" />
                  {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Địa chỉ giao hàng <span className="text-red-500">*</span></Label>
                  <Input id="address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className={`mt-1.5 ${errors.address ? 'border-red-500' : ''}`} placeholder="123 Đường ABC, Phường XYZ" data-testid="checkout-address-input" />
                  {errors.address && <p className="text-sm text-red-500 mt-1">{errors.address}</p>}
                </div>
                <div>
                  <Label htmlFor="province">Tỉnh/Thành phố <span className="text-red-500">*</span></Label>
                  <Select value={formData.province} onValueChange={(value) => setFormData({...formData, province: value})}>
                    <SelectTrigger className={`mt-1.5 ${errors.province ? 'border-red-500' : ''}`} data-testid="checkout-province-select">
                      <SelectValue placeholder="Chọn tỉnh/thành phố" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.province && <p className="text-sm text-red-500 mt-1">{errors.province}</p>}
                </div>
                <div>
                  <Label htmlFor="district">Quận/Huyện <span className="text-red-500">*</span></Label>
                  <Input id="district" value={formData.district} onChange={(e) => setFormData({...formData, district: e.target.value})} className={`mt-1.5 ${errors.district ? 'border-red-500' : ''}`} placeholder="Quận 1" data-testid="checkout-district-input" />
                  {errors.district && <p className="text-sm text-red-500 mt-1">{errors.district}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="detail_address">Địa chỉ chi tiết (Số nhà, tên đường...) <span className="text-red-500">*</span></Label>
                  <Input id="detail_address" value={formData.detail_address} onChange={(e) => setFormData({...formData, detail_address: e.target.value})} className={`mt-1.5 ${errors.detail_address ? 'border-red-500' : ''}`} placeholder="Số 12, ngõ 34, đường ABC..." data-testid="checkout-detail-address-input" />
                  {errors.detail_address && <p className="text-sm text-red-500 mt-1">{errors.detail_address}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="payment_method">Phương thức thanh toán</Label>
                  <Select value={formData.payment_method} onValueChange={(value) => setFormData({...formData, payment_method: value})}>
                    <SelectTrigger className="mt-1.5" data-testid="checkout-payment-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cod">Thanh toán khi nhận hàng (COD)</SelectItem>
                      <SelectItem value="bank_transfer">Chuyển khoản ngân hàng</SelectItem>
                      <SelectItem value="momo">Ví MoMo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="notes">Ghi chú (không bắt buộc)</Label>
                  <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="mt-1.5" placeholder="Ghi chú thêm về đơn hàng..." rows={3} data-testid="checkout-notes-input" />
                </div>
              </div>
              {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
              <Button type="submit" className="w-full bg-[#2C5F2D]" disabled={loading} data-testid="checkout-submit-button">
                {loading ? <Loader2 className="animate-spin" /> : 'Đặt Hàng'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* QR Code Panel - shows when bank transfer selected */}
        {formData.payment_method === 'bank_transfer' && (
          <Card className="border-2 border-[#2C5F2D] shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#2C5F2D] to-[#4a8c4b] text-white rounded-t-xl pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <CreditCard size={22} />
                Thanh Toán Chuyển Khoản
              </CardTitle>
              <CardDescription className="text-green-100">Quét mã QR hoặc chuyển theo thông tin bên dưới</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* QR Code */}
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-white rounded-2xl shadow-md border border-gray-100">
                    <img
                      src={qrUrl}
                      alt="QR Code MB Bank"
                      className="w-52 h-52 object-contain"
                      onError={(e) => { e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MB|${ACCOUNT_NO}|${cartTotal}|ThanhToanHuuCo`; }}
                    />
                  </div>
                  <span className="text-sm text-[#5C6656] font-medium">Quét mã bằng App Ngân hàng</span>
                </div>

                {/* Bank Info */}
                <div className="flex-1 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-[#5C6656] text-sm">Ngân hàng</span>
                      <span className="font-bold text-[#1A2118] flex items-center gap-2">
                        <span className="bg-[#005BAA] text-white text-xs px-2 py-0.5 rounded font-bold">MB</span>
                        MB Bank
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-[#5C6656] text-sm">Số tài khoản</span>
                      <span className="font-bold text-[#1A2118] text-lg tracking-widest">{ACCOUNT_NO}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-[#5C6656] text-sm">Chủ tài khoản</span>
                      <span className="font-bold text-[#1A2118]">{ACCOUNT_NAME}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-[#5C6656] text-sm">Số tiền</span>
                      <span className="font-bold text-[#2C5F2D] text-xl">{formatVND(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-[#5C6656] text-sm">Nội dung CK</span>
                      <span className="font-medium text-[#1A2118] text-sm">Thanh toan don hang huu co</span>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-amber-800 text-sm">⚠️ Vui lòng chuyển khoản trước khi bấm <strong>Đặt Hàng</strong>. Đơn hàng sẽ được xác nhận sau khi chúng tôi nhận được thanh toán.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MoMo QR Code Panel - shows when momo selected */}
        {formData.payment_method === 'momo' && (
          <Card className="border-2 border-[#A50064] shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#A50064] to-[#C83885] text-white rounded-t-xl pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <CreditCard size={22} />
                Thanh Toán Qua Ví MoMo
              </CardTitle>
              <CardDescription className="text-pink-100">Quét mã QR hoặc chuyển khoản ví MoMo theo thông tin bên dưới</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* QR Code */}
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-white rounded-2xl shadow-md border border-gray-100">
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=00020101021138620010A00000072701320006970454011899MM24037M595256790208QRIBFTTA53037045802VN62190515MOMOW2W5952567963041F86"
                      alt="QR Code MoMo"
                      className="w-52 h-52 object-contain"
                    />
                  </div>
                  <span className="text-sm text-[#5C6656] font-medium">Quét mã bằng App MoMo / Ngân hàng</span>
                </div>

                {/* MoMo Info */}
                <div className="flex-1 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-[#5C6656] text-sm">Hình thức</span>
                      <span className="font-bold text-[#A50064] flex items-center gap-2">
                        <span className="bg-[#A50064] text-white text-xs px-2 py-0.5 rounded font-bold">MoMo</span>
                        Ví Điện Tử MoMo
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-[#5C6656] text-sm">Số điện thoại MoMo</span>
                      <span className="font-bold text-[#1A2118] text-lg tracking-widest">0966399780</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-[#5C6656] text-sm">Chủ tài khoản</span>
                      <span className="font-bold text-[#1A2118]">NGUYEN DUC HOAN</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-[#5C6656] text-sm">Số tiền</span>
                      <span className="font-bold text-[#A50064] text-xl">{formatVND(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-[#5C6656] text-sm">Lời nhắn</span>
                      <span className="font-medium text-[#1A2118] text-sm">Thanh toan don hang huu co</span>
                    </div>
                  </div>
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                    <p className="text-pink-800 text-sm">⚠️ Vui lòng chuyển tiền qua MoMo trước khi bấm <strong>Đặt Hàng</strong>. Đơn hàng sẽ được xác nhận sau khi chúng tôi nhận được thanh toán.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};


const ProfilePage = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Đã đăng xuất thành công');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] py-8 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Tài Khoản Của Tôi</CardTitle>
              <CardDescription>Thông tin tài khoản và cài đặt</CardDescription>
            </div>
            <div className="w-16 h-16 bg-[#2C5F2D] rounded-full flex items-center justify-center">
              <User className="text-white" size={32} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#F8F9F6] rounded-lg">
              <Label className="text-sm text-[#5C6656]">Tên người dùng</Label>
              <p className="text-lg font-semibold text-[#1A2118] mt-1">
                {isAdmin ? user?.username : user?.full_name || user?.email}
              </p>
            </div>
            <div className="p-4 bg-[#F8F9F6] rounded-lg">
              <Label className="text-sm text-[#5C6656]">Email</Label>
              <p className="text-lg font-semibold text-[#1A2118] mt-1">
                {user?.email || 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-[#F8F9F6] rounded-lg">
              <Label className="text-sm text-[#5C6656]">Loại tài khoản</Label>
              <p className="text-lg font-semibold text-[#1A2118] mt-1">
                {isAdmin ? 'Quản trị viên' : 'Khách hàng'}
              </p>
            </div>
            <div className="p-4 bg-[#F8F9F6] rounded-lg">
              <Label className="text-sm text-[#5C6656]">Trạng thái</Label>
              <p className="text-lg font-semibold text-[#2C5F2D] mt-1">Đang hoạt động</p>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <h3 className="font-semibold text-[#1A2118] mb-3">Cài đặt tài khoản</h3>
            {!isAdmin && (
              <>
                <Link to="/cart">
                  <Button variant="outline" className="w-full justify-start">
                    <ShoppingCart size={18} className="mr-2" />
                    Giỏ hàng của tôi
                  </Button>
                </Link>
              </>
            )}
            {isAdmin && (
              <>
                <Link to="/admin/products">
                  <Button variant="outline" className="w-full justify-start">
                    <Package size={18} className="mr-2" />
                    Quản lý sản phẩm
                  </Button>
                </Link>
                <Link to="/admin/inventory">
                  <Button variant="outline" className="w-full justify-start">
                    <Package size={18} className="mr-2" />
                    Quản lý kho
                  </Button>
                </Link>
                <Link to="/chat">
                  <Button variant="outline" className="w-full justify-start">
                    <MessageSquare size={18} className="mr-2" />
                    Chatbot dinh dưỡng
                  </Button>
                </Link>
                <Link to="/ocr-search">
                  <Button variant="outline" className="w-full justify-start">
                    <Camera size={18} className="mr-2" />
                    Nhận diện bằng ảnh
                  </Button>
                </Link>
              </>
            )}
            <Link to="/contact">
              <Button variant="outline" className="w-full justify-start">
                <Mail size={18} className="mr-2" />
                Liên hệ hỗ trợ
              </Button>
            </Link>
          </div>

          <div className="border-t pt-6">
            <Button 
              onClick={handleLogout} 
              variant="destructive" 
              className="w-full"
              data-testid="profile-logout-button"
            >
              <LogOut size={18} className="mr-2" />
              Đăng xuất
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ContactPage = () => {
  const [formData, setFormData] = useState({
    full_name: '', email: '', phone: '', subject: '', message: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!formData.full_name) newErrors.full_name = 'Vui lòng nhập họ tên';
    if (!formData.email) newErrors.email = 'Vui lòng nhập email';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email không hợp lệ';
    if (!formData.phone) newErrors.phone = 'Vui lòng nhập số điện thoại';
    if (!formData.subject) newErrors.subject = 'Vui lòng nhập chủ đề';
    if (!formData.message) newErrors.message = 'Vui lòng nhập nội dung';
    else if (formData.message.length < 10) newErrors.message = 'Nội dung phải có ít nhất 10 ký tự';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await axios.post(`${API}/contact`, formData);
      toast.success('Gửi liên hệ thành công! Chúng tôi sẽ phản hồi sớm.');
      setFormData({ full_name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      setErrors({ submit: 'Gửi thông tin thất bại. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] py-8 px-4">
      <Card className="max-w-2xl mx-auto relative">
        <CardHeader className="text-center">
          <button onClick={() => navigate(-1)} className="absolute left-6 top-6 text-[#5C6656] hover:text-[#2C5F2D]" data-testid="contact-back-button">
            <ArrowLeft size={20} />
          </button>
          <CardTitle className="text-2xl">Liên Hệ Với Chúng Tôi</CardTitle>
          <CardDescription>Gửi câu hỏi hoặc phản hồi của bạn. Chúng tôi luôn sẵn sàng hỗ trợ!</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="contact-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Họ và tên <span className="text-red-500">*</span></Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className={`mt-1.5 ${errors.full_name ? 'border-red-500' : ''}`}
                  placeholder="Nguyễn Văn A"
                  data-testid="contact-fullname-input"
                />
                {errors.full_name && <p className="text-sm text-red-500 mt-1">{errors.full_name}</p>}
              </div>
              <div>
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`mt-1.5 ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="email@example.com"
                  data-testid="contact-email-input"
                />
                {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="phone">Số điện thoại <span className="text-red-500">*</span></Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className={`mt-1.5 ${errors.phone ? 'border-red-500' : ''}`}
                  placeholder="0912345678"
                  data-testid="contact-phone-input"
                />
                {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="subject">Chủ đề <span className="text-red-500">*</span></Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  className={`mt-1.5 ${errors.subject ? 'border-red-500' : ''}`}
                  placeholder="Vấn đề cần hỗ trợ"
                  data-testid="contact-subject-input"
                />
                {errors.subject && <p className="text-sm text-red-500 mt-1">{errors.subject}</p>}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="message">Nội dung <span className="text-red-500">*</span></Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className={`mt-1.5 ${errors.message ? 'border-red-500' : ''}`}
                  placeholder="Mô tả chi tiết nội dung cần liên hệ..."
                  rows={5}
                  data-testid="contact-message-input"
                />
                {errors.message && <p className="text-sm text-red-500 mt-1">{errors.message}</p>}
              </div>
            </div>
            {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
            <Button type="submit" className="w-full bg-[#2C5F2D]" disabled={loading} data-testid="contact-submit-button">
              {loading ? <Loader2 className="animate-spin" /> : 'Gửi Liên Hệ'}
            </Button>
          </form>
          <div className="mt-6 pt-6 border-t space-y-3">
            <div className="flex items-center gap-3 text-[#5C6656]">
              <Phone size={20} className="text-[#2C5F2D]" />
              <span>Hotline: 1900 xxxx</span>
            </div>
            <div className="flex items-center gap-3 text-[#5C6656]">
              <Mail size={20} className="text-[#2C5F2D]" />
              <span>Email: support@organicstore.vn</span>
            </div>
            <div className="flex items-center gap-3 text-[#5C6656]">
              <MapPin size={20} className="text-[#2C5F2D]" />
              <span>Địa chỉ: 123 Đường Hữu Cơ, Quận 1, TP.HCM</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};



const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const messagesEndRef = React.useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post(`${API}/chat`, { message: input }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(prev => [...prev, { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role: 'ai', text: response.data.response }]);
    } catch (error) {
      const detail = error.response?.data?.detail || 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.';
      toast.error('Không thể gửi tin nhắn');
      setMessages(prev => [...prev, { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role: 'ai', text: detail }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] flex flex-col" data-testid="chat-page">
      <nav className="bg-white border-b border-[#E3E8E0] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="text-[#5C6656] hover:text-[#2C5F2D]"><ArrowLeft size={20} /></Link>
          <div className="flex items-center gap-2">
            <Bot size={24} className="text-[#2C5F2D]" />
            <h1 className="text-lg font-semibold text-[#1A2118]">Trợ Lý Dinh Dưỡng AI</h1>
          </div>
          <Link to="/ocr-search" className="ml-auto">
            <Button size="sm" variant="outline" data-testid="ocr-link-button">
              <Camera size={16} className="mr-2" />
              Nhận diện ảnh
            </Button>
          </Link>
        </div>
      </nav>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <Bot size={56} className="mx-auto text-[#2C5F2D] mb-4" />
            <h2 className="text-2xl font-semibold text-[#1A2118] mb-2">Xin chào!</h2>
            <p className="text-[#5C6656] mb-6">Tôi là trợ lý AI chuyên về dinh dưỡng thực phẩm hữu cơ Việt Nam.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {['Rau muống có tác dụng gì?', 'Thanh long tốt cho sức khỏe thế nào?', 'Cà phê hữu cơ khác gì thường?'].map(q => (
                <button 
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="px-4 py-2 bg-white border border-[#E3E8E0] rounded-full text-sm text-[#5C6656] hover:border-[#2C5F2D] hover:text-[#2C5F2D] transition-colors"
                  data-testid="chat-suggestion"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={msg.id ?? `${msg.role}-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#2C5F2D] text-white'
                  : 'bg-white border border-[#E3E8E0] text-[#1A2118]'
              }`} data-testid={`chat-message-${msg.role}`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-[#E3E8E0] rounded-2xl px-4 py-3">
                <Loader2 className="animate-spin text-[#2C5F2D]" size={20} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-[#E3E8E0] bg-white p-4">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi về dinh dưỡng thực phẩm hữu cơ..."
            className="flex-1"
            disabled={loading}
            data-testid="chat-input"
          />
          <Button type="submit" className="bg-[#2C5F2D]" disabled={loading || !input.trim()} data-testid="chat-send-button">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </Button>
        </form>
      </div>
    </div>
  );
};

const OcrMatchedProducts = ({ products, token, navigate }) => {
  const [quantities, setQuantities] = useState(() => {
    const init = {};
    products.forEach(p => { init[p.ProductID] = 1; });
    return init;
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailQty, setDetailQty] = useState(1);

  const updateQty = (productId, delta) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta)
    }));
  };

  const addToCart = async (productId, qty) => {
    if (!token) {
      toast.error('Vui lòng đăng nhập để mua hàng');
      navigate('/login');
      return;
    }
    try {
      await axios.post(`${API}/cart/add`, { product_id: productId, quantity: qty || quantities[productId] || 1 }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Đã thêm ${qty || quantities[productId] || 1} sản phẩm vào giỏ hàng`);
      setQuantities(prev => ({ ...prev, [productId]: 1 }));
    } catch (error) {
      toast.error('Không thể thêm vào giỏ hàng');
    }
  };

  const openDetail = (product) => {
    setSelectedProduct(product);
    setDetailQty(1);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sản phẩm liên quan trong cửa hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(p => (
              <div
                key={p.ProductID}
                className="flex flex-col rounded-xl border border-[#E3E8E0] overflow-hidden hover:border-[#2C5F2D] hover:shadow-md transition-all group"
                data-testid={`ocr-product-${p.ProductID}`}
              >
                <div
                  className="flex items-center gap-4 p-3 cursor-pointer"
                  onClick={() => openDetail(p)}
                >
                  <div className="relative w-20 h-20 shrink-0">
                    <img src={p.PathImage} alt={p.ProductName} className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300" />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-white/80 text-[#2C5F2D] text-[10px] font-bold px-2 py-0.5 rounded-full">Chi tiết</span>
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#1A2118] truncate">{p.ProductName}</h4>
                    <p className="text-xs text-[#5C6656]">{p.ProductType}</p>
                    <p className="text-[#2C5F2D] font-bold text-sm mt-0.5">{formatVND(p.Price)}</p>
                    {p.Origin && <p className="text-xs text-[#5C6656] mt-0.5">🌍 {p.Origin}</p>}
                  </div>
                </div>
                <div className="border-t border-[#E3E8E0] px-3 py-2 flex items-center gap-2 bg-[#F8F9F6]">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm" variant="outline"
                      className="h-7 w-7 p-0"
                      onClick={() => updateQty(p.ProductID, -1)}
                      disabled={(quantities[p.ProductID] || 1) <= 1}
                      data-testid={`ocr-qty-decrease-${p.ProductID}`}
                    ><Minus size={12} /></Button>
                    <span className="w-7 text-center text-sm font-medium text-[#1A2118]" data-testid={`ocr-qty-${p.ProductID}`}>{quantities[p.ProductID] || 1}</span>
                    <Button
                      size="sm" variant="outline"
                      className="h-7 w-7 p-0"
                      onClick={() => updateQty(p.ProductID, 1)}
                      data-testid={`ocr-qty-increase-${p.ProductID}`}
                    ><Plus size={12} /></Button>
                  </div>
                  <Button
                    size="sm"
                    className="flex-1 bg-[#2C5F2D] hover:bg-[#1E441F] h-8 text-xs"
                    onClick={() => addToCart(p.ProductID)}
                    data-testid={`ocr-add-to-cart-${p.ProductID}`}
                  >
                    <ShoppingCart size={13} className="mr-1.5" />
                    Thêm vào giỏ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {selectedProduct && (
            <div className="flex flex-col md:flex-row">
              <div className="md:w-2/5 relative">
                <img src={selectedProduct.PathImage} alt={selectedProduct.ProductName} className="w-full h-64 md:h-full object-cover" />
                <span className="absolute top-3 left-3 bg-[#2C5F2D] text-white text-xs font-bold px-3 py-1 rounded-full">{selectedProduct.ProductType}</span>
              </div>
              <div className="md:w-3/5 p-6 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
                <div>
                  <h2 className="text-2xl font-bold text-[#1A2118] mb-1">{selectedProduct.ProductName}</h2>
                  <p className="text-2xl font-bold text-[#2C5F2D]">{formatVND(selectedProduct.Price)}<span className="text-sm font-normal text-[#5C6656] ml-1">/ {selectedProduct.Unit}</span></p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedProduct.Origin && (
                    <div className="bg-[#F0F4EE] rounded-lg p-3">
                      <p className="text-[#5C6656] text-xs mb-1">Xuất xứ</p>
                      <p className="font-semibold text-[#1A2118]">{selectedProduct.Origin}</p>
                    </div>
                  )}
                  <div className="bg-[#F0F4EE] rounded-lg p-3">
                    <p className="text-[#5C6656] text-xs mb-1">Số lượng còn</p>
                    <p className="font-semibold text-[#1A2118]">{selectedProduct.Quantity} {selectedProduct.Unit}</p>
                  </div>
                  {selectedProduct.Certification && (
                    <div className="bg-green-50 rounded-lg p-3 col-span-2">
                      <p className="text-[#5C6656] text-xs mb-1">✅ Chứng nhận</p>
                      <p className="font-semibold text-[#2C5F2D]">{selectedProduct.Certification}</p>
                    </div>
                  )}
                </div>

                {selectedProduct.Description && (
                  <div>
                    <p className="text-sm font-semibold text-[#1A2118] mb-1">Mô tả sản phẩm</p>
                    <p className="text-sm text-[#5C6656] leading-relaxed">{selectedProduct.Description}</p>
                  </div>
                )}

                <div className="mt-auto pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-medium text-[#1A2118]">Số lượng:</span>
                    <Button size="sm" variant="outline" onClick={() => setDetailQty(q => Math.max(1, q - 1))} className="h-9 w-9 p-0"><Minus size={14} /></Button>
                    <span className="w-10 text-center font-bold text-lg">{detailQty}</span>
                    <Button size="sm" variant="outline" onClick={() => setDetailQty(q => q + 1)} className="h-9 w-9 p-0"><Plus size={14} /></Button>
                  </div>
                  <Button
                    className="w-full bg-[#2C5F2D] hover:bg-[#1E441F] h-12 text-base font-semibold"
                    onClick={() => { addToCart(selectedProduct.ProductID, detailQty); setSelectedProduct(null); }}
                    data-testid="ocr-detail-add-to-cart"
                  >
                    <ShoppingCart size={18} className="mr-2" />
                    Thêm {detailQty} vào giỏ hàng &mdash; {formatVND(selectedProduct.Price * detailQty)}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const ImageSearchPage = () => {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = React.useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target.result);
      const base64Data = event.target.result.split(',')[1];
      setImageBase64(base64Data);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

 const handleIdentify = async () => {
    if (!imageBase64 || loading) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/ocr/identify`, 
        { image_base64: imageBase64 }, 
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setResult(response.data);
      toast.success('Nhận diện thành công!');
    } catch (error) {
      console.error("Lỗi nhận diện AI:", error.response);
      const errorMsg = error.response?.data?.detail || 'Không thể nhận diện ảnh. Vui lòng thử lại.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6]" data-testid="ocr-search-page">
      <nav className="bg-white border-b border-[#E3E8E0] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-[#5C6656] hover:text-[#2C5F2D]"><ArrowLeft size={20} /></button>
          <div className="flex items-center gap-2">
            <Camera size={24} className="text-[#2C5F2D]" />
            <h1 className="text-lg font-semibold text-[#1A2118]">Tìm Kiếm Bằng Hình Ảnh</h1>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="text-center">
              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#E3E8E0] rounded-xl p-12 cursor-pointer hover:border-[#2C5F2D] transition-colors"
                  data-testid="image-upload-area"
                >
                  <Upload size={48} className="mx-auto text-[#5C6656] mb-4" />
                  <p className="text-lg font-medium text-[#1A2118] mb-2">Tải ảnh rau củ quả lên</p>
                  <p className="text-sm text-[#5C6656]">Hỗ trợ JPEG, PNG, WebP</p>
                </div>
              ) : (
                <div>
                  <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-xl mb-4 object-contain" />
                  <div className="flex gap-3 justify-center">
                    <Button onClick={handleIdentify} className="bg-[#2C5F2D]" disabled={loading} data-testid="identify-button">
                      {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Search size={18} className="mr-2" />}
                      {loading ? 'Đang nhận diện...' : 'Nhận diện'}
                    </Button>
                    <Button variant="outline" onClick={() => { setImagePreview(null); setImageBase64(''); setResult(null); }} data-testid="clear-image-button">
                      Chọn ảnh khác
                    </Button>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageSelect}
                className="hidden"
                data-testid="image-file-input"
              />
            </div>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-6" data-testid="ocr-results">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Kết quả nhận diện</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[#1A2118] whitespace-pre-wrap leading-relaxed" data-testid="ocr-identification-text">{result.identification}</p>
              </CardContent>
            </Card>

            {result.matched_products && result.matched_products.length > 0 && (
              <OcrMatchedProducts products={result.matched_products} token={token} navigate={navigate} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};


const AdminOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const { token } = useAuth();
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
      setFilteredOrders(response.data);
    } catch (error) {
      toast.error('Không thể tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Normalize legacy statuses so action buttons always show correctly
  const isPendingStatus = useCallback((s) => s === 'pending' || s === 'processing', []);
  const isConfirmedStatus = useCallback((s) => s === 'confirmed', []);
  const isDoneStatus = useCallback((s) => s === 'completed' || s === 'delivered', []);
  const isCancelledStatus = useCallback((s) => s === 'cancelled', []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredOrders(orders);
    } else if (filterStatus === 'pending') {
      setFilteredOrders(orders.filter(o => isPendingStatus(o.status)));
    } else if (filterStatus === 'confirmed') {
      setFilteredOrders(orders.filter(o => isConfirmedStatus(o.status)));
    } else if (filterStatus === 'completed') {
      setFilteredOrders(orders.filter(o => isDoneStatus(o.status)));
    } else if (filterStatus === 'cancelled') {
      setFilteredOrders(orders.filter(o => isCancelledStatus(o.status)));
    } else {
      setFilteredOrders(orders.filter(o => o.status === filterStatus));
    }
  }, [orders, filterStatus, isPendingStatus, isConfirmedStatus, isDoneStatus, isCancelledStatus]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await axios.put(`${API}/admin/orders/${orderId}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Cập nhật trạng thái đơn hàng thành công');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Không thể cập nhật trạng thái đơn hàng');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
      case 'processing':
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">Chờ xác nhận</span>;
      case 'confirmed':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Đã xác nhận</span>;
      case 'completed':
      case 'delivered':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Hoàn thành</span>;
      case 'cancelled':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">Đã hủy</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] p-8" data-testid="admin-orders-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1A2118]">Quản Lý Đơn Hàng</h1>
            <p className="text-sm text-[#5C6656] mt-1">Duyệt, xác nhận và quản lý đơn đặt hàng từ khách hàng</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/admin/products')} className="bg-[#2C5F2D] hover:bg-[#1E441F]">
              <Package className="mr-2" size={18} />
              Quản lý sản phẩm
            </Button>
            <Button onClick={() => navigate('/admin/inventory')} variant="outline" className="border-[#2C5F2D] text-[#2C5F2D] hover:bg-green-50">
              Quản lý kho
            </Button>
            <Button onClick={() => navigate('/')} variant="outline">
              Về Trang Chủ
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 'all', label: 'Tất cả', color: 'bg-gray-100 text-gray-800' },
            { id: 'pending', label: 'Chờ xác nhận', color: 'bg-amber-100 text-amber-800' },
            { id: 'confirmed', label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800' },
            { id: 'completed', label: 'Hoàn thành', color: 'bg-green-100 text-green-800' },
            { id: 'cancelled', label: 'Đã hủy', color: 'bg-red-100 text-red-800' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold text-left transition-all border-2 ${
                filterStatus === tab.id ? 'border-[#2C5F2D] shadow-md scale-[1.02]' : 'border-transparent'
              } ${tab.color}`}
            >
              <div className="text-lg font-bold">
                {tab.id === 'all' ? orders.length
                  : tab.id === 'pending' ? orders.filter(o => isPendingStatus(o.status)).length
                  : tab.id === 'completed' ? orders.filter(o => isDoneStatus(o.status)).length
                  : tab.id === 'cancelled' ? orders.filter(o => isCancelledStatus(o.status)).length
                  : orders.filter(o => o.status === tab.id).length}
              </div>
              <div>{tab.label}</div>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-[#2C5F2D]" size={32} />
            <p className="mt-3 text-[#5C6656]">Đang tải đơn hàng...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <ShoppingCart className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-[#5C6656] font-medium">Không có đơn hàng nào trong trạng thái này</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => {
              const info = order.shipping_info || {};
              const items = order.items || [];
              return (
                <Card key={order.order_id} className="border border-[#E3E8E0] hover:shadow-md transition-shadow overflow-hidden">
                  {/* Order Header */}
                  <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-[#1A2118] text-lg">
                          Đơn hàng #{(order.order_id || '').slice(-6).toUpperCase()}
                        </span>
                        {getStatusBadge(order.status)}
                        <span className="text-xs text-[#5C6656]">
                          {order.created_at ? new Date(order.created_at).toLocaleString('vi-VN') : ''}
                        </span>
                      </div>
                      <p className="text-sm text-[#5C6656]">
                        Khách: <strong className="text-[#1A2118]">{info.full_name || 'N/A'}</strong>
                        {' · '}{info.phone || ''}
                        {' · '}
                        <span className="font-semibold text-[#EF4444]">{formatVND(order.total || 0)}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {isPendingStatus(order.status) && (
                        <>
                          <Button size="sm" onClick={() => handleUpdateStatus(order.order_id, 'confirmed')} className="bg-[#2C5F2D] hover:bg-[#1E441F]">
                            ✓ Xác nhận đơn
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(order.order_id, 'cancelled')}>
                            ✕ Hủy đơn
                          </Button>
                        </>
                      )}
                      {isConfirmedStatus(order.status) && (
                        <>
                          <Button size="sm" onClick={() => handleUpdateStatus(order.order_id, 'completed')} className="bg-blue-600 hover:bg-blue-700 text-white">
                            ✓ Hoàn thành đơn
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(order.order_id, 'cancelled')}>
                            ✕ Hủy đơn
                          </Button>
                        </>
                      )}
                      {isDoneStatus(order.status) && (
                        <span className="text-xs text-green-600 font-semibold bg-green-50 px-3 py-1.5 rounded-lg">✓ Đã hoàn thành</span>
                      )}
                      {isCancelledStatus(order.status) && (
                        <span className="text-xs text-red-500 font-semibold bg-red-50 px-3 py-1.5 rounded-lg">✕ Đã hủy</span>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Shipping & Payment Info */}
                      <div>
                        <h4 className="font-semibold text-[#1A2118] mb-3 pb-2 border-b text-sm uppercase tracking-wide text-gray-500">
                          Thông tin giao hàng
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex gap-2">
                            <span className="text-[#5C6656] w-24 shrink-0">Địa chỉ:</span>
                            <span className="font-medium text-[#1A2118]">
                              {[info.address, info.district, info.province].filter(Boolean).join(', ') || 'N/A'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-[#5C6656] w-24 shrink-0">Thanh toán:</span>
                            <span className={`font-bold ${
                              info.payment_method === 'momo' ? 'text-[#A50064]' :
                              info.payment_method === 'bank_transfer' ? 'text-[#005BAA]' : 'text-[#2C5F2D]'
                            }`}>
                              {info.payment_method === 'cod' && '💵 Thanh toán COD'}
                              {info.payment_method === 'bank_transfer' && '🏦 Chuyển khoản MB Bank'}
                              {info.payment_method === 'momo' && '🌸 Ví điện tử MoMo'}
                              {!info.payment_method && 'COD'}
                            </span>
                          </div>
                          {info.notes && (
                            <div className="flex gap-2">
                              <span className="text-[#5C6656] w-24 shrink-0">Ghi chú:</span>
                              <span className="text-amber-800 bg-amber-50 px-2 py-1 rounded text-xs">{info.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Items List */}
                      <div>
                        <h4 className="font-semibold text-[#1A2118] mb-3 pb-2 border-b text-sm uppercase tracking-wide text-gray-500">
                          Sản phẩm ({items.length})
                        </h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {items.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">Không có sản phẩm</p>
                          ) : items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              {item.image && (
                                <img src={item.image} alt={item.product_name} className="w-9 h-9 object-cover rounded border shrink-0" onError={e => e.target.style.display='none'} />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#1A2118] truncate">{item.product_name || 'Sản phẩm'}</p>
                                <p className="text-xs text-[#5C6656]">{formatVND(item.price || 0)} × {item.quantity || 1}</p>
                              </div>
                              <span className="text-sm font-semibold text-[#1A2118] shrink-0">{formatVND((item.price || 0) * (item.quantity || 1))}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center pt-3 mt-2 border-t">
                          <span className="font-semibold text-[#1A2118]">Tổng cộng:</span>
                          <span className="font-bold text-lg text-[#EF4444]">{formatVND(order.total || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


const InventoryPage = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    ProductName: '',
    ProductType: '',
    Quantity: 0,
    Unit: '',
    Price: 0
  });
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    type: true,
    price: true,
    quantity: true
  });
  const { token } = useAuth();
  const navigate = useNavigate();

  const fetchProducts = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/products/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data);
      setFilteredProducts(response.data);
    } catch (error) {
      toast.error('Không thể tải dữ liệu kho');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(fetchProducts, 5000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredProducts(products.filter(p =>
        p.ProductName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.ProductType.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    } else {
      setFilteredProducts(products);
    }
  }, [products, searchQuery]);

  const handleEdit = (product) => {
    setCurrentProduct(product);
    setEditForm({
      ProductName: product.ProductName,
      ProductType: product.ProductType,
      Quantity: product.Quantity,
      Unit: product.Unit,
      Price: product.Price
    });
    setEditDialogOpen(true);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    
    if (editForm.Quantity < 0) {
      toast.error('Số lượng không được âm');
      return;
    }
    if (editForm.Price < 0) {
      toast.error('Giá không được âm');
      return;
    }

    try {
      await axios.put(`${API}/products/${currentProduct.ProductID}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Cập nhật sản phẩm thành công');
      setEditDialogOpen(false);
      fetchProducts();
    } catch (error) {
      toast.error('Không thể cập nhật sản phẩm');
    }
  };

  const handleDelete = async (productId) => {
    try {
      await axios.delete(`${API}/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Đã xóa sản phẩm');
      fetchProducts();
    } catch (error) {
      toast.error('Không thể xóa sản phẩm');
    }
  };

  const lowStockCount = products.filter(p => p.Quantity < 10).length;
  const categoryStats = products.reduce((acc, p) => {
    acc[p.ProductType] = (acc[p.ProductType] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(categoryStats).map(([name, value]) => ({
    name,
    value,
    percentage: ((value / products.length) * 100).toFixed(1)
  }));

  const colors = {
    'Rau củ': '#10b981',
    'Trái cây': '#3b82f6',
    'Ngũ cốc': '#f59e0b',
    'Đồ uống': '#8b5cf6',
    'Gia vị': '#ef4444'
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-[#1A2118]">Quản Lý Kho</h1>
          <Button onClick={() => navigate(-1)} variant="outline">
            Quay lại
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#F0F4EE] rounded-lg flex items-center justify-center">
                  <Package className="text-[#2C5F2D]" size={24} />
                </div>
                <div>
                  <p className="text-sm text-[#5C6656]">Tổng mặt hàng</p>
                  <p className="text-3xl font-bold text-[#1A2118]">{products.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                  <Package className="text-[#F59E0B]" size={24} />
                </div>
                <div>
                  <p className="text-sm text-[#5C6656]">Sắp hết hàng (&lt;10)</p>
                  <p className="text-3xl font-bold text-[#F59E0B]">{lowStockCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#DBEAFE] rounded-lg flex items-center justify-center">
                  <ShoppingCart className="text-[#3B82F6]" size={24} />
                </div>
                <div>
                  <p className="text-sm text-[#5C6656]">Danh mục</p>
                  <p className="text-3xl font-bold text-[#1A2118]">{Object.keys(categoryStats).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Tỷ lệ chủng loại thực phẩm</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-8">
                <div className="relative w-48 h-48">
                  <svg viewBox="0 0 100 100" className="transform -rotate-90">
                    {chartData.reduce((acc, item) => {
                      const total = chartData.reduce((s, i) => s + i.value, 0);
                      const percentage = (item.value / total) * 100;
                      const startAngle = acc.angle;
                      const endAngle = startAngle + (percentage * 3.6);
                      
                      const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                      const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                      const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                      const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                      
                      const largeArc = percentage > 50 ? 1 : 0;
                      const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
                      
                      acc.paths.push(
                        <path
                          key={item.name}
                          d={path}
                          fill={colors[item.name] || '#gray'}
                          stroke="white"
                          strokeWidth="1"
                        />
                      );
                      acc.angle = endAngle;
                      return acc;
                    }, { paths: [], angle: 0 }).paths}
                    <circle cx="50" cy="50" r="25" fill="white" />
                  </svg>
                </div>
                <div className="space-y-2">
                  {chartData.map(item => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: colors[item.name] || '#gray' }}></div>
                      <span className="text-sm text-[#5C6656]">{item.name}</span>
                      <span className="text-sm font-medium text-[#1A2118]">({item.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sản phẩm sắp hết</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {products.filter(p => p.Quantity < 10).slice(0, 5).map(product => (
                  <div key={product.ProductID} className="flex justify-between items-center">
                    <span className="text-sm text-[#5C6656]">{product.ProductName}</span>
                    <span className="text-sm font-medium text-[#F59E0B]">{product.Quantity} {product.Unit}</span>
                  </div>
                ))}
                {lowStockCount === 0 && (
                  <p className="text-sm text-[#5C6656] text-center py-4">Tất cả sản phẩm đều đủ hàng</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#5C6656]" size={20} />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm trong kho..."
                  className="pl-10"
                  data-testid="inventory-search"
                />
              </div>
              <Button onClick={() => navigate('/admin/products')} className="bg-[#2C5F2D]">
                <Plus size={18} className="mr-2" />
                Nhập Hàng Mới
              </Button>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-[#5C6656] mb-2">Tùy chỉnh hiển thị:</p>
              <div className="flex gap-4">
                {[
                  ['name', 'Tên'],
                  ['type', 'Loại'],
                  ['price', 'Giá'],
                  ['quantity', 'Số lượng'],
                ].map(([col, label]) => (
                  <label key={col} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col]}
                      onChange={() => setVisibleColumns({...visibleColumns, [col]: !visibleColumns[col]})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm capitalize">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="animate-spin mx-auto" size={32} />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-[#5C6656]">
                <p className="mb-4">Không có sản phẩm nào trong kho</p>
                <Button onClick={() => navigate('/admin/products')} className="bg-[#2C5F2D]">
                  <Plus size={18} className="mr-2" />
                  Thêm sản phẩm đầu tiên
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.name && <TableHead>Tên sản phẩm</TableHead>}
                    {visibleColumns.type && <TableHead>Loại</TableHead>}
                    {visibleColumns.price && <TableHead>Giá</TableHead>}
                    {visibleColumns.quantity && <TableHead>Số lượng</TableHead>}
                    <TableHead>Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map(product => (
                    <TableRow key={product.ProductID}>
                      {visibleColumns.name && (
                        <TableCell className="font-medium">{product.ProductName}</TableCell>
                      )}
                      {visibleColumns.type && (
                        <TableCell>
                          <span className="px-3 py-1 bg-[#DBEAFE] text-[#3B82F6] rounded-full text-sm whitespace-nowrap">
                            {product.ProductType}
                          </span>
                        </TableCell>
                      )}
                      {visibleColumns.price && (
                        <TableCell className="text-[#EF4444] font-semibold">{formatVND(product.Price)}</TableCell>
                      )}
                      {visibleColumns.quantity && (
                        <TableCell className={product.Quantity < 10 ? 'text-[#F59E0B] font-semibold' : 'text-[#10B981]'}>
                          {product.Quantity} {product.Unit}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleEdit(product)}
                            className="bg-[#3B82F6]"
                            data-testid={`edit-inventory-${product.ProductID}`}
                          >
                            Sửa
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" data-testid={`delete-inventory-${product.ProductID}`}>
                                Xóa
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Xóa sản phẩm khỏi kho?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Bạn có chắc muốn xóa {product.ProductName}? Hành động này không thể hoàn tác.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(product.ProductID)}>Xóa</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sửa Sản Phẩm</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div>
                <Label>Tên sản phẩm</Label>
                <Input
                  value={editForm.ProductName}
                  onChange={(e) => setEditForm({...editForm, ProductName: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>Loại</Label>
                <Input
                  value={editForm.ProductType}
                  onChange={(e) => setEditForm({...editForm, ProductType: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Số lượng</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.Quantity}
                    onChange={(e) => setEditForm({...editForm, Quantity: Math.max(0, parseFloat(e.target.value) || 0)})}
                    required
                  />
                </div>
                <div>
                  <Label>Đơn vị</Label>
                  <Input
                    value={editForm.Unit}
                    onChange={(e) => setEditForm({...editForm, Unit: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Giá (VND)</Label>
                <Input
                  type="number"
                  step="1000"
                  min="0"
                  value={editForm.Price}
                  onChange={(e) => setEditForm({...editForm, Price: Math.max(0, parseFloat(e.target.value) || 0)})}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" className="bg-[#2C5F2D]">
                  Cập nhật
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};


const AdminProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [formData, setFormData] = useState({
    ProductName: '', PathImage: '', ProductType: '', Quantity: '', Unit: '', Price: '', Description: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [visibleCols, setVisibleCols] = useState({ image: true, name: true, type: true, qty: true, price: true, desc: false, origin: false });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const itemsPerPage = 8;
  const { token, logout, user } = useAuth();
  const navigate = useNavigate();

  const fetchProducts = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/products/admin`, { headers: { Authorization: `Bearer ${token}` } });
      setProducts(response.data);
    } catch (error) { toast.error('Không thể tải danh sách sản phẩm'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(fetchProducts, 5000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key === 'n') { e.preventDefault(); handleOpenDialog(); }
      if (e.altKey && e.key === 's') { e.preventDefault(); document.querySelector('[data-testid="submit-product-button"]')?.click(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // handleOpenDialog is a stable inline handler defined below within this component;
    // it does not depend on props/state that would change identity per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = products.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (searchType === 'name') return p.ProductName.toLowerCase().includes(q);
    if (searchType === 'type') return p.ProductType.toLowerCase().includes(q);
    if (searchType === 'origin') return (p.Origin || '').toLowerCase().includes(q);
    return p.ProductName.toLowerCase().includes(q) || p.ProductType.toLowerCase().includes(q) || (p.Description || '').toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleOpenDialog = (product = null) => {
    if (product) {
      setEditMode(true); setCurrentProduct(product);
      setFormData({ ProductName: product.ProductName, PathImage: product.PathImage, ProductType: product.ProductType, Quantity: product.Quantity, Unit: product.Unit, Price: product.Price, Description: product.Description });
      setImagePreview(product.PathImage || '');
    } else {
      setEditMode(false); setCurrentProduct(null);
      setFormData({ ProductName: '', PathImage: '', ProductType: '', Quantity: '', Unit: '', Price: '', Description: '' });
      setImagePreview('');
    }
    setImageFile(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseFloat(formData.Quantity); const price = parseFloat(formData.Price);
    if (qty < 0 || price < 0) { toast.error('Số lượng và giá không được âm'); return; }
    
    let finalPathImage = formData.PathImage;
    
    // Upload new image if a file was selected
    if (imageFile) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', imageFile);
        const uploadRes = await axios.post(`${API}/upload-image`, fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        finalPathImage = uploadRes.data.url;
      } catch {
        toast.error('Upload ảnh thất bại');
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }
    
    const payload = { ...formData, PathImage: finalPathImage };
    try {
      if (editMode) {
        await axios.put(`${API}/products/${currentProduct.ProductID}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Cập nhật sản phẩm thành công');
      } else {
        await axios.post(`${API}/products`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Thêm sản phẩm thành công');
      }
      setDialogOpen(false); fetchProducts();
    } catch (error) { toast.error('Không thể lưu sản phẩm'); }
  };

  const handleDelete = async (productId) => {
    try {
      await axios.delete(`${API}/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Xóa sản phẩm thành công'); fetchProducts();
    } catch (error) { toast.error('Không thể xóa sản phẩm'); }
  };

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => {
    if (selectedIds.length === paginated.length) setSelectedIds([]);
    else setSelectedIds(paginated.map(p => p.ProductID));
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await axios.delete(`${API}/products/bulk`, { headers: { Authorization: `Bearer ${token}` }, data: selectedIds });
      toast.success(`Đã xóa ${selectedIds.length} sản phẩm`); setSelectedIds([]); fetchProducts();
    } catch (error) { toast.error('Xóa hàng loạt thất bại'); }
  };

  const bulkDuplicate = async () => {
    if (selectedIds.length === 0) return;
    try {
      await axios.post(`${API}/products/duplicate`, selectedIds, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Đã nhân bản ${selectedIds.length} sản phẩm`); setSelectedIds([]); fetchProducts();
    } catch (error) { toast.error('Nhân bản thất bại'); }
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify(filtered, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'san_pham.json'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file JSON');
  };

  const exportExcel = () => {
    const BOM = '\uFEFF';
    const headers = ['ProductID', 'Tên', 'Loại', 'Số lượng', 'Đơn vị', 'Giá', 'Mô tả', 'Xuất xứ', 'Chứng nhận'];
    const rows = filtered.map(p => [p.ProductID, p.ProductName, p.ProductType, p.Quantity, p.Unit, p.Price, p.Description, p.Origin, p.Certification].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    const csv = BOM + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'san_pham.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file Excel (CSV)');
  };

  return (
    <div className="min-h-screen bg-[#F8F9F6]" data-testid="admin-products-page">
      <nav className="bg-white border-b border-[#E3E8E0]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-[#1A2118]">Quản Trị Viên</h1>
          <div className="flex items-center gap-3">
            <Link to="/admin/orders"><Button size="sm" className="bg-[#2C5F2D] hover:bg-[#1E441F] text-white">Quản lý đơn hàng</Button></Link>
            <Link to="/admin/inventory"><Button size="sm" variant="outline">Quản lý kho</Button></Link>
            <Link to="/chat"><Button size="sm" variant="outline"><MessageSquare size={16} className="mr-1" />Chatbot</Button></Link>
            <span className="text-sm text-[#5C6656]">Xin chào, {user?.username}</span>
            <Button onClick={() => { logout(); navigate('/login'); }} variant="outline" size="sm"><LogOut size={16} className="mr-1" />Đăng xuất</Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-semibold text-[#1A2118]">Quản Lý Sản Phẩm</h2>
            <p className="text-[#5C6656] mt-1">Tổng: {filtered.length} sản phẩm | Phím tắt: Alt+N (thêm), Alt+S (lưu)</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={exportJSON} variant="outline" size="sm" data-testid="export-json-button"><FileJson size={16} className="mr-1" />JSON</Button>
            <Button onClick={exportExcel} variant="outline" size="sm" data-testid="export-excel-button"><FileSpreadsheet size={16} className="mr-1" />Excel</Button>
            <Button onClick={() => handleOpenDialog()} className="bg-[#2C5F2D]" data-testid="add-product-button"><Plus size={18} className="mr-2" />Thêm Sản Phẩm</Button>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6656]" size={18} />
                  <Input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder="Tìm kiếm sản phẩm..." className="pl-10" data-testid="admin-search-input" />
                </div>
                <Select value={searchType} onValueChange={setSearchType}>
                  <SelectTrigger className="w-36" data-testid="search-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="name">Tên</SelectItem>
                    <SelectItem value="type">Loại</SelectItem>
                    <SelectItem value="origin">Xuất xứ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedIds.length > 0 && (
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" data-testid="bulk-delete-button"><Trash2 size={16} className="mr-1" />Xóa ({selectedIds.length})</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Xóa {selectedIds.length} sản phẩm?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={bulkDelete}>Xóa</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button onClick={bulkDuplicate} variant="outline" size="sm" data-testid="bulk-duplicate-button"><Copy size={16} className="mr-1" />Nhân bản ({selectedIds.length})</Button>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-4 flex-wrap">
              <p className="text-sm font-medium text-[#5C6656]">Hiển thị cột:</p>
              {[['image','Hình'],['name','Tên'],['type','Loại'],['qty','SL'],['price','Giá'],['desc','Mô tả'],['origin','Xuất xứ']].map(([k,l]) => (
                <label key={k} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={visibleCols[k]} onChange={() => setVisibleCols({...visibleCols, [k]: !visibleCols[k]})} className="w-3.5 h-3.5" />
                  {l}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          {(() => {
            if (loading) {
              return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto" size={32} /></div>;
            }
            if (filtered.length === 0) {
              return <div className="p-12 text-center text-[#5C6656]">Không tìm thấy sản phẩm</div>;
            }
            return (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input type="checkbox" checked={selectedIds.length === paginated.length && paginated.length > 0} onChange={toggleSelectAll} className="w-4 h-4" data-testid="select-all-checkbox" />
                    </TableHead>
                    {visibleCols.image && <TableHead>Hình</TableHead>}
                    {visibleCols.name && <TableHead>Tên</TableHead>}
                    {visibleCols.type && <TableHead>Loại</TableHead>}
                    {visibleCols.qty && <TableHead>Số lượng</TableHead>}
                    {visibleCols.price && <TableHead>Giá</TableHead>}
                    {visibleCols.desc && <TableHead>Mô tả</TableHead>}
                    {visibleCols.origin && <TableHead>Xuất xứ</TableHead>}
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((p) => (
                    <TableRow key={p.ProductID} className={selectedIds.includes(p.ProductID) ? 'bg-[#F0F4EE]' : ''}>
                      <TableCell>
                        <input type="checkbox" checked={selectedIds.includes(p.ProductID)} onChange={() => toggleSelect(p.ProductID)} className="w-4 h-4" data-testid={`select-product-${p.ProductID}`} />
                      </TableCell>
                      {visibleCols.image && <TableCell><img src={p.PathImage} alt={p.ProductName} className="w-14 h-14 object-cover rounded" /></TableCell>}
                      {visibleCols.name && <TableCell className="font-medium">{p.ProductName}</TableCell>}
                      {visibleCols.type && <TableCell><span className="px-2 py-1 bg-[#DBEAFE] text-[#3B82F6] rounded-full text-xs whitespace-nowrap">{p.ProductType}</span></TableCell>}
                      {visibleCols.qty && <TableCell>{p.Quantity} {p.Unit}</TableCell>}
                      {visibleCols.price && <TableCell className="font-bold text-[#2C5F2D]">{formatVND(p.Price)}</TableCell>}
                      {visibleCols.desc && <TableCell className="max-w-[200px] truncate text-sm">{p.Description}</TableCell>}
                      {visibleCols.origin && <TableCell className="text-sm">{p.Origin}</TableCell>}
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleOpenDialog(p)} className="bg-[#97BC62]" data-testid={`edit-product-${p.ProductID}`}><Edit size={14} /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="sm" variant="destructive" data-testid={`delete-product-${p.ProductID}`}><Trash2 size={14} /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Xóa sản phẩm?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(p.ProductID)} data-testid={`confirm-delete-${p.ProductID}`}>Xóa</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t" data-testid="pagination">
                  <p className="text-sm text-[#5C6656]">Trang {currentPage}/{totalPages} ({filtered.length} sản phẩm)</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} data-testid="prev-page"><ChevronLeft size={16} /></Button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <Button key={i} size="sm" variant={currentPage === i + 1 ? 'default' : 'outline'} onClick={() => setCurrentPage(i + 1)} className={currentPage === i + 1 ? 'bg-[#2C5F2D]' : ''}>{i + 1}</Button>
                    ))}
                    <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} data-testid="next-page"><ChevronRight size={16} /></Button>
                  </div>
                </div>
              )}
            </>
            );
          })()}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="product-dialog">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} data-testid="product-form">
            <div className="grid grid-cols-2 gap-4 my-4">
              <div>
                <Label>Tên sản phẩm</Label>
                <Input value={formData.ProductName} onChange={(e) => setFormData({...formData, ProductName: e.target.value})} required data-testid="input-product-name" />
              </div>
              <div>
                <Label>Loại sản phẩm</Label>
                <Input value={formData.ProductType} onChange={(e) => setFormData({...formData, ProductType: e.target.value})} required data-testid="input-product-type" />
              </div>
              <div>
                <Label>Số lượng</Label>
                <Input type="number" step="0.01" min="0" value={formData.Quantity} onChange={(e) => setFormData({...formData, Quantity: Math.max(0, parseFloat(e.target.value) || 0)})} required data-testid="input-quantity" />
              </div>
              <div>
                <Label>Đơn vị</Label>
                <Input value={formData.Unit} onChange={(e) => setFormData({...formData, Unit: e.target.value})} placeholder="kg, lít" required data-testid="input-unit" />
              </div>
              <div>
                <Label>Giá (VND)</Label>
                <Input type="number" step="1000" min="0" value={formData.Price} onChange={(e) => setFormData({...formData, Price: Math.max(0, parseFloat(e.target.value) || 0)})} required data-testid="input-price" />
              </div>
              <div className="col-span-2">
                <Label>Hình ảnh sản phẩm</Label>
                <div className="mt-1.5 border-2 border-dashed border-gray-200 rounded-lg p-4 hover:border-[#2C5F2D] transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Preview */}
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center shrink-0 border">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={28} className="text-gray-400" />
                      )}
                    </div>
                    {/* Controls */}
                    <div className="flex-1">
                      <label htmlFor="image-upload" className="cursor-pointer inline-flex items-center gap-2 bg-[#2C5F2D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#1E441F] transition-colors">
                        <Upload size={16} />
                        Chọn ảnh từ máy tính
                      </label>
                      <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setImageFile(file);
                            setImagePreview(URL.createObjectURL(file));
                            setFormData(prev => ({...prev, PathImage: ''}));
                          }
                        }}
                      />
                      <p className="text-xs text-[#5C6656] mt-2">Hoặc nhập URL ảnh trực tiếp:</p>
                      <Input
                        value={imageFile ? '' : formData.PathImage}
                        onChange={(e) => { setFormData({...formData, PathImage: e.target.value}); setImagePreview(e.target.value); setImageFile(null); }}
                        placeholder="https://..."
                        className="mt-1 text-sm"
                        data-testid="input-image"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <Label>Mô tả</Label>
                <Textarea value={formData.Description} onChange={(e) => setFormData({...formData, Description: e.target.value})} required data-testid="input-description" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-[#2C5F2D]" disabled={uploading} data-testid="submit-product-button">
                {uploading ? <><Loader2 size={16} className="animate-spin mr-2" />Đang tải ảnh...</> : (editMode ? 'Cập Nhật' : 'Tạo Sản Phẩm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/ocr-search" element={<ProtectedRoute><ImageSearchPage /></ProtectedRoute>} />
          <Route path="/admin/inventory" element={<ProtectedRoute adminOnly><InventoryPage /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
          <Route path="/admin/products" element={<ProtectedRoute adminOnly><AdminProductsPage /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute adminOnly><AdminOrdersPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;