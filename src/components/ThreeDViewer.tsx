import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, PerspectiveCamera } from '@react-three/drei';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface ThreeDViewerProps {
  type: 'dna' | 'cube' | 'sphere' | 'torus';
  isDarkMode: boolean;
}

const DNA = () => {
  const spheres = [];
  for (let i = 0; i < 20; i++) {
    const y = (i - 10) * 0.5;
    const angle = i * 0.5;
    const x1 = Math.cos(angle) * 2;
    const z1 = Math.sin(angle) * 2;
    const x2 = Math.cos(angle + Math.PI) * 2;
    const z2 = Math.sin(angle + Math.PI) * 2;
    
    spheres.push(
      <group key={i}>
        <mesh position={[x1, y, z1]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#6366f1" />
        </mesh>
        <mesh position={[x2, y, z2]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ec4899" />
        </mesh>
        <mesh position={[(x1 + x2) / 2, y, (z1 + z2) / 2]} rotation={[0, 0, angle]}>
          <boxGeometry args={[4, 0.1, 0.1]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      </group>
    );
  }
  return <group>{spheres}</group>;
};

export const ThreeDViewer: React.FC<ThreeDViewerProps> = ({ type, isDarkMode }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
      >
        View 3D {type.toUpperCase()}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border",
            isDarkMode ? "bg-[#0b1220] border-white/10" : "bg-white border-slate-200"
          )}>
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h3 className="font-bold">3D Visualization: {type.toUpperCase()}</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-black">
              <Canvas shadows dpr={[1, 2]}>
                <PerspectiveCamera makeDefault position={[0, 0, 15]} />
                <Suspense fallback={null}>
                  <Stage environment="city" intensity={0.6}>
                    {type === 'dna' && <DNA />}
                    {type === 'cube' && (
                      <mesh>
                        <boxGeometry args={[4, 4, 4]} />
                        <meshStandardMaterial color="#6366f1" />
                      </mesh>
                    )}
                    {type === 'sphere' && (
                      <mesh>
                        <sphereGeometry args={[3, 32, 32]} />
                        <meshStandardMaterial color="#ec4899" />
                      </mesh>
                    )}
                    {type === 'torus' && (
                      <mesh>
                        <torusGeometry args={[3, 1, 16, 100]} />
                        <meshStandardMaterial color="#f59e0b" />
                      </mesh>
                    )}
                  </Stage>
                </Suspense>
                <OrbitControls autoRotate />
              </Canvas>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
