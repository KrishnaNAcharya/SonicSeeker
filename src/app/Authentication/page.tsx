'use client';
import { useState } from 'react';
import Head from 'next/head';

export default function AuthPage() {
    const [isHovered, setIsHovered] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    // Login state
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Signup state
    const [signupUsername, setSignupUsername] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

    const toggleAuthMode = () => {
        setIsSignUp(!isSignUp);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loginUsername, password: loginPassword })
            });

            const data = await res.json();
            if (res.ok && data.token) {
                localStorage.setItem("token", data.token);
                alert('Login successful!');
                window.location.href = '/home';
                // Do further logic like redirect or saving token
            } else {
                alert(data.message || 'Login failed');
            }
        } catch (err) {
            console.error('Login error:', err);
            alert('Something went wrong during login.');
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (signupPassword !== signupConfirmPassword) {
            alert("Passwords don't match");
            return;
        }

        try {
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: signupUsername,
                    email: signupEmail,
                    password: signupPassword
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert('Account created!');
                setIsSignUp(false); // Switch to login view
            } else {
                alert(data.message || 'Signup failed');
            }
        } catch (err) {
            console.error('Signup error:', err);
            alert('Something went wrong during signup.');
        }
    };

    return (
        <>
            <Head>
                <title>{isSignUp ? 'Sign Up' : 'Login'} - Modern Animated Form</title>
                <link href="https://fonts.googleapis.com/css?family=Poppins:200,300,400,500,600,700,800,900&display=swap" rel="stylesheet" />
                <link href="https://use.fontawesome.com/releases/v6.5.1/css/all.css" rel="stylesheet" />
            </Head>

            <div className="flex justify-center items-center min-h-screen bg-[#25252b] font-['Poppins']">
                <div
                    className={`relative ${isHovered ? 'w-[450px] h-[560px]' : 'w-[400px] h-[200px]'} rounded-[20px] transition-all duration-500`}
                    style={{ filter: 'drop-shadow(0 15px 50px #000)' }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* Gradient borders */}
                    <div className="absolute inset-0 rounded-[20px] animate-[rotate_4s_linear_infinite]"
                        style={{
                            background: 'repeating-conic-gradient(from var(--angle), #8b5cf6 0%, #8b5cf6 5%, transparent 5%, transparent 40%, #8b5cf6 50%)',
                            filter: 'drop-shadow(0 15px 50px #000)',
                            '--angle': '0deg'
                        }}
                    ></div>

                    <div className="absolute inset-0 rounded-[20px] animate-[rotate_4s_linear_infinite] delay-1000"
                        style={{
                            background: 'repeating-conic-gradient(from var(--angle), #3b82f6 0%, #3b82f6 5%, transparent 5%, transparent 40%, #3b82f6 50%)',
                            filter: 'drop-shadow(0 15px 50px #000)',
                            '--angle': '0deg',
                            animationDelay: '-1s'
                        }}
                    ></div>

                    <div className="absolute inset-[4px] bg-[#2d2d39] rounded-[15px] border-[8px] border-[#25252b]" />

                    {/* Inner form container */}
                    <div
                        className={`absolute z-10 flex justify-center items-center flex-col rounded-[10px] bg-[#00000033] text-white shadow-[inset_0_10px_20px_#00000080] border-b-2 border-b-[#ffffff80] transition-all duration-500 overflow-hidden ${isHovered ? 'inset-[40px]' : 'inset-[60px]'}`}
                    >
                        {!isSignUp ? (
                            <form
                                onSubmit={handleLogin}
                                className="relative flex justify-center items-center flex-col gap-5 w-[70%] transition-all duration-500"
                                style={{ transform: isHovered ? 'translateY(0)' : 'translateY(12px)' }}
                            >
                                <h2 className="uppercase font-semibold tracking-[0.2em]">
                                    <i className="fa-solid fa-right-to-bracket text-[#8b5cf6]" style={{ textShadow: '0 0 5px #8b5cf6, 0 0 20px #8b5cf6' }}></i>
                                    {' Login '}
                                    <i className="fa-solid fa-heart text-[#8b5cf6]" style={{ textShadow: '0 0 5px #8b5cf6, 0 0 20px #8b5cf6' }}></i>
                                </h2>

                                <div className={`w-full flex flex-col gap-5 ${isHovered ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0 overflow-hidden'} transition-all duration-500`}>
                                    <input
                                        type="text"
                                        placeholder="Username"
                                        value={loginUsername}
                                        onChange={(e) => setLoginUsername(e.target.value)}
                                        className="w-full px-5 py-2.5 border-2 border-white bg-[#0000001a] rounded-[30px] text-white"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        className="w-full px-5 py-2.5 border-2 border-white bg-[#0000001a] rounded-[30px] text-white"
                                    />
                                    <input
                                        type="submit"
                                        value="Sign in"
                                        className="w-full px-5 py-2.5 bg-[#3b82f6] text-[#111] font-medium rounded-[30px] cursor-pointer hover:shadow-[0_0_10px_#3b82f6,0_0_60px_#3b82f6]"
                                    />
                                    <div className="flex justify-between w-full text-sm">
                                        <a href="#" className="text-white">Forgot Password</a>
                                        <a href="#" onClick={(e) => { e.preventDefault(); toggleAuthMode(); }} className="text-[#8b5cf6] font-semibold">Sign up</a>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <form
                                onSubmit={handleSignup}
                                className="relative flex justify-center items-center flex-col gap-5 w-[70%] transition-all duration-500"
                                style={{ transform: isHovered ? 'translateY(0)' : 'translateY(12px)' }}
                            >
                                <h2 className="uppercase font-semibold tracking-[0.2em]">
                                    <i className="fa-solid fa-user-plus text-[#8b5cf6]" style={{ textShadow: '0 0 5px #8b5cf6, 0 0 20px #8b5cf6' }}></i>
                                    {' Sign Up '}
                                    <i className="fa-solid fa-heart text-[#8b5cf6]" style={{ textShadow: '0 0 5px #8b5cf6, 0 0 20px #8b5cf6' }}></i>
                                </h2>

                                <div className={`w-full flex flex-col gap-5 ${isHovered ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0 overflow-hidden'} transition-all duration-500`}>
                                    <input
                                        type="text"
                                        placeholder="Username"
                                        value={signupUsername}
                                        onChange={(e) => setSignupUsername(e.target.value)}
                                        className="w-full px-5 py-2.5 border-2 border-white bg-[#0000001a] rounded-[30px] text-white"
                                    />
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={signupEmail}
                                        onChange={(e) => setSignupEmail(e.target.value)}
                                        className="w-full px-5 py-2.5 border-2 border-white bg-[#0000001a] rounded-[30px] text-white"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={signupPassword}
                                        onChange={(e) => setSignupPassword(e.target.value)}
                                        className="w-full px-5 py-2.5 border-2 border-white bg-[#0000001a] rounded-[30px] text-white"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Confirm Password"
                                        value={signupConfirmPassword}
                                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                        className="w-full px-5 py-2.5 border-2 border-white bg-[#0000001a] rounded-[30px] text-white"
                                    />
                                    <input
                                        type="submit"
                                        value="Create Account"
                                        className="w-full px-5 py-2.5 bg-[#3b82f6] text-[#111] font-medium rounded-[30px] cursor-pointer hover:shadow-[0_0_10px_#3b82f6,0_0_60px_#3b82f6]"
                                    />
                                    <div className="flex justify-between w-full text-sm">
                                        <span className="text-white">Already have an account?</span>
                                        <a href="#" onClick={(e) => { e.preventDefault(); toggleAuthMode(); }} className="text-[#8b5cf6] font-semibold">Login</a>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* Animation CSS */}
            <style jsx global>{`
        @keyframes rotate {
          0% { --angle: 0deg; }
          100% { --angle: 360deg; }
        }
        @property --angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
      `}</style>
        </>
    );
}
