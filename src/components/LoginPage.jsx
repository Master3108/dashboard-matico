import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Loader, Sparkles, Eye, EyeOff } from 'lucide-react';

const LoginPage = ({ onLogin }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        // N8N Webhook URL (Same as the main app)
        const WEBHOOK_URL = 'https://n8n-n8n.cwf1hb.easypanel.host/webhook/MATICO';

        const action = isRegistering ? 'register' : 'login';

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: action,
                    email: formData.email,
                    password: formData.password,
                    name: isRegistering ? formData.name : undefined // Send name only for register
                })
            });

            const data = await response.json();

            if (data.success || (data.user_id && !data.error)) {
                // Success!
                onLogin({
                    user_id: data.user_id,
                    username: data.name || formData.name || 'Estudiante',
                    email: formData.email
                });
            } else {
                throw new Error(data.message || data.error || 'Error en la autenticación');
            }

        } catch (err) {
            console.error("Auth error:", err);
            setError(err.message || "No se pudo conectar con el servidor. Intenta de nuevo.");

            // DEMO FALLBACK (Para que puedas probar la UI sin el backend listo aún)
            // Si falla la conexión, permitimos entrar como demo si es el usuario de prueba
            if (formData.email === 'demo@matico.ai' && formData.password === 'demo') {
                onLogin({
                    user_id: "123e4567-e89b-12d3-a456-426614174000",
                    username: "Estudiante Demo",
                    email: "demo@matico.ai"
                });
            }

        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#E0E5EC] flex items-center justify-center p-6 relative overflow-hidden">

            {/* Background Decorations */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-400 rounded-full opacity-20 blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-purple-400 rounded-full opacity-20 blur-3xl animate-pulse delay-1000"></div>

            <div className="bg-white/80 backdrop-blur-xl w-full max-w-md p-8 rounded-3xl shadow-2xl border border-white relative z-10 transition-all duration-300">

                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                        <span className="text-4xl">🐶</span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-800 mb-2 tracking-tight">
                        {isRegistering ? '¡Únete a Matico!' : '¡Hola de nuevo!'}
                    </h1>
                    <p className="text-gray-500 font-medium">
                        {isRegistering ? 'Crea tu cuenta para empezar a aprender' : 'Ingresa para continuar tu progreso'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">

                    {isRegistering && (
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-gray-600 ml-1">Nombre</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    name="name"
                                    required={isRegistering}
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Tu nombre"
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-gray-700 placeholder:text-gray-400"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-600 ml-1">Correo Electrónico</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="tu@correo.com"
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-gray-700 placeholder:text-gray-400"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-600 ml-1">Contraseña</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className="w-full pl-12 pr-12 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-gray-700 placeholder:text-gray-400"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-lg animate-fadeIn flex items-center gap-2">
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-lg rounded-xl shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <Loader className="w-5 h-5 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>

                {/* Footer / Toggle */}
                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <p className="text-gray-500 font-medium mb-2">
                        {isRegistering ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}
                    </p>
                    <button
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="text-blue-600 font-black hover:text-blue-700 transition-colors flex items-center justify-center gap-1 mx-auto group"
                    >
                        {isRegistering ? 'Inicia Sesión aquí' : 'Regístrate es gratis'}
                        <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    </button>
                </div>

                {/* Demo Hint */}
                <div className="mt-4 text-center text-xs text-gray-400">
                    <p>Demo: demo@matico.ai / demo</p>
                </div>

            </div>
        </div>
    );
};

export default LoginPage;
