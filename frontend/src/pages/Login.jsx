import React from 'react';
import ufcLogo from '../assets/ufc-logo.png';
import useLoginData from './Login/hooks/useLoginData';
import LoginHeader from './Login/components/LoginHeader';
import LoginIntro from './Login/components/LoginIntro';
import LoginForm from './Login/components/LoginForm';
import LoginFooter from './Login/components/LoginFooter';

export default function Login() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    error,
    loading,
    handleLogin,
    navigateToHome,
  } = useLoginData();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <LoginHeader logoUrl={ufcLogo} onBack={navigateToHome} />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl grid gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] items-center">
          <LoginIntro />

          <LoginForm
            error={error}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            loading={loading}
            onSubmit={handleLogin}
          />
        </div>
      </main>

      <LoginFooter />
    </div>
  );
}
