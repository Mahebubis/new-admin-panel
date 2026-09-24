// import { useEffect, useRef } from 'react';
// import { X } from 'lucide-react';

// export default function SkillSpiderChartModal({ show, onClose, skills, skillLevels, highlightIndex, subdomain }) {
//     const canvasRef = useRef(null);

//     useEffect(() => {
//         if (!show || !canvasRef.current || skills.length === 0) return;

//         const canvas = canvasRef.current;
//         const ctx = canvas.getContext('2d');
//         const centerX = canvas.width / 2;
//         const centerY = canvas.height / 2;
//         const maxRadius = Math.min(centerX, centerY) - 60;

//         // Clear canvas
//         ctx.clearRect(0, 0, canvas.width, canvas.height);

//         // Draw background circles
//         const circles = 5;
//         for (let i = circles; i > 0; i--) {
//             ctx.beginPath();
//             ctx.arc(centerX, centerY, (maxRadius / circles) * i, 0, Math.PI * 2);
//             ctx.strokeStyle = i === circles ? '#E5E7EB' : '#F3F4F6';
//             ctx.lineWidth = 1;
//             ctx.stroke();
//         }

//         // Draw axes
//         const angleStep = (Math.PI * 2) / skills.length;
//         skills.forEach((_, index) => {
//             const angle = angleStep * index - Math.PI / 2;
//             const x = centerX + Math.cos(angle) * maxRadius;
//             const y = centerY + Math.sin(angle) * maxRadius;

//             ctx.beginPath();
//             ctx.moveTo(centerX, centerY);
//             ctx.lineTo(x, y);
//             ctx.strokeStyle = '#E5E7EB';
//             ctx.lineWidth = 1;
//             ctx.stroke();
//         });

//         // Draw skill polygon
//         ctx.beginPath();
//         skillLevels.forEach((level, index) => {
//             const angle = angleStep * index - Math.PI / 2;
//             const radius = (level / 100) * maxRadius;
//             const x = centerX + Math.cos(angle) * radius;
//             const y = centerY + Math.sin(angle) * radius;

//             if (index === 0) {
//                 ctx.moveTo(x, y);
//             } else {
//                 ctx.lineTo(x, y);
//             }
//         });
//         ctx.closePath();
//         ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
//         ctx.fill();
//         ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
//         ctx.lineWidth = 2;
//         ctx.stroke();

//         // Draw skill points and labels
//         ctx.font = '12px system-ui, -apple-system, sans-serif';
//         ctx.textAlign = 'center';
//         ctx.textBaseline = 'middle';

//         skills.forEach((skill, index) => {
//             const angle = angleStep * index - Math.PI / 2;
//             const level = skillLevels[index];
//             const radius = (level / 100) * maxRadius;
//             const x = centerX + Math.cos(angle) * radius;
//             const y = centerY + Math.sin(angle) * radius;

//             // Draw point
//             ctx.beginPath();
//             ctx.arc(x, y, index === highlightIndex ? 8 : 5, 0, Math.PI * 2);
//             ctx.fillStyle = index === highlightIndex ? '#4F46E5' : '#6366F1';
//             ctx.fill();
//             ctx.strokeStyle = 'white';
//             ctx.lineWidth = 2;
//             ctx.stroke();

//             // Draw label
//             const labelRadius = maxRadius + 30;
//             const labelX = centerX + Math.cos(angle) * labelRadius;
//             const labelY = centerY + Math.sin(angle) * labelRadius;

//             // Adjust text alignment based on position
//             if (labelX > centerX + 5) {
//                 ctx.textAlign = 'left';
//             } else if (labelX < centerX - 5) {
//                 ctx.textAlign = 'right';
//             } else {
//                 ctx.textAlign = 'center';
//             }

//             // Skill name
//             ctx.fillStyle = index === highlightIndex ? '#4F46E5' : '#374151';
//             ctx.font = index === highlightIndex ? 'bold 13px system-ui' : '12px system-ui';
//             ctx.fillText(skill, labelX, labelY - 8);

//             // Skill percentage
//             ctx.fillStyle = index === highlightIndex ? '#6366F1' : '#6B7280';
//             ctx.font = index === highlightIndex ? 'bold 11px system-ui' : '11px system-ui';
//             ctx.fillText(`${level}%`, labelX, labelY + 6);
//         });

//         // Draw percentage labels on circles
//         ctx.textAlign = 'center';
//         ctx.textBaseline = 'middle';
//         ctx.font = '10px system-ui';
//         ctx.fillStyle = '#9CA3AF';
//         for (let i = 1; i <= circles; i++) {
//             const percentage = (i / circles) * 100;
//             ctx.fillText(`${percentage.toFixed(0)}%`, centerX, centerY - (maxRadius / circles) * i + 3);
//         }

//     }, [show, skills, skillLevels, highlightIndex]);

//     if (!show) return null;

//     return (
//         <div
//             onClick={onClose}
//             className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fade-in"
//         >
//             <div
//                 onClick={(e) => e.stopPropagation()}
//                 className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-scale-in"
//             >
//                 {/* Header */}
//                 <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
//                     <div>
//                         <h2 className="text-lg sm:text-xl font-bold text-white">Skills Proficiency Chart</h2>
//                         <p className="text-xs sm:text-sm text-indigo-100 mt-1">{subdomain}</p>
//                     </div>
//                     <button
//                         onClick={onClose}
//                         className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors backdrop-blur-sm"
//                     >
//                         <X className="w-5 h-5 text-white" />
//                     </button>
//                 </div>

//                 {/* Content */}
//                 <div className="p-6 sm:p-8">
//                     <div className="flex items-center justify-center mb-6">
//                         <canvas
//                             ref={canvasRef}
//                             width={600}
//                             height={600}
//                             className="max-w-full h-auto"
//                         />
//                     </div>

//                     {/* Legend */}
//                     <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
//                         <div className="flex items-center justify-center gap-6 flex-wrap">
//                             <div className="flex items-center gap-2">
//                                 <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
//                                 <span className="text-xs text-gray-700 font-medium">Your Skill Level</span>
//                             </div>
//                             <div className="flex items-center gap-2">
//                                 <div className="w-3 h-3 rounded-full bg-gray-300"></div>
//                                 <span className="text-xs text-gray-700 font-medium">Target Level</span>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Skill Details */}
//                     <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
//                         {skills.map((skill, index) => (
//                             <div
//                                 key={index}
//                                 className={`p-3 rounded-lg border-2 transition-all ${
//                                     index === highlightIndex
//                                         ? 'border-indigo-500 bg-indigo-50'
//                                         : 'border-gray-200 bg-white hover:border-gray-300'
//                                 }`}
//                             >
//                                 <div className="flex items-center justify-between mb-1">
//                                     <span className={`text-xs font-medium ${
//                                         index === highlightIndex ? 'text-indigo-900' : 'text-gray-700'
//                                     }`}>
//                                         {skill}
//                                     </span>
//                                     <span className={`text-xs font-bold ${
//                                         index === highlightIndex ? 'text-indigo-600' : 'text-gray-600'
//                                     }`}>
//                                         {skillLevels[index]}%
//                                     </span>
//                                 </div>
//                                 <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
//                                     <div
//                                         className={`h-full rounded-full transition-all duration-500 ${
//                                             index === highlightIndex ? 'bg-indigo-600' : 'bg-gray-400'
//                                         }`}
//                                         style={{ 
//                                             width: `${skillLevels[index]}%`,
//                                             animationDelay: `${index * 0.1}s`
//                                         }}
//                                     />
//                                 </div>
//                             </div>
//                         ))}
//                     </div>

//                     {/* Close Button */}
//                     <div className="mt-6 flex justify-center">
//                         <button
//                             onClick={onClose}
//                             className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
//                         >
//                             Close
//                         </button>
//                     </div>
//                 </div>
//             </div>

//             <style jsx>{`
//                 @keyframes fade-in {
//                     from {
//                         opacity: 0;
//                     }
//                     to {
//                         opacity: 1;
//                     }
//                 }

//                 @keyframes scale-in {
//                     from {
//                         opacity: 0;
//                         transform: scale(0.9);
//                     }
//                     to {
//                         opacity: 1;
//                         transform: scale(1);
//                     }
//                 }

//                 .animate-fade-in {
//                     animation: fade-in 0.2s ease-out;
//                 }

//                 .animate-scale-in {
//                     animation: scale-in 0.3s ease-out;
//                 }
//             `}</style>
//         </div>
//     );
// }









import React from "react";

const SkillSpiderChartModal = ({ skills, skillLevels, highlightIndex = 0, show, onClose, subdomain }) => {
    if (!show) return null;

    const size = 500;      // bigger canvas
    const center = size / 2;
    const radius = 170;
    const angleStep = (Math.PI * 2) / skills.length;

    // Calculate skill value points
    const getSkillPoints = () => {
        return skillLevels.map((level, index) => {
            const angle = angleStep * index - Math.PI / 2;
            const r = (radius * level) / 100;
            return {
                x: center + r * Math.cos(angle),
                y: center + r * Math.sin(angle)
            };
        });
    };

    // Calculate label positions with better spacing
    const getLabelPosition = (index) => {
        const angle = angleStep * index - Math.PI / 2;
        const r = radius + 50; // Increased distance for better visibility
        return {
            x: center + r * Math.cos(angle),
            y: center + r * Math.sin(angle),
            angle: angle
        };
    };

    const skillPoints = getSkillPoints();
    const pathData =
        skillPoints
            .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ") + " Z";

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999999]"
            onClick={onClose}   // closes modal when clicking outside
        >
            {/* <div
                className="bg-white p-4 rounded-xl shadow-xl w-[500px] h-[520px] flex items-center justify-center"
                onClick={(e) => e.stopPropagation()} // prevents closing on inside click
            > */}
            <div
                // className="bg-white p-4 rounded-xl shadow-xl w-[500px] h-[520px] flex items-center justify-center"
                className="relative bg-white p-4 rounded-xl shadow-xl 
           w-[95vw] max-w-[500px] 
           h-[95vh] max-h-[520px] 
           flex items-center justify-center"

                onClick={(e) => e.stopPropagation()}
            >

                {/* HEADER */}
                <div className="absolute top-0 left-0 w-full rounded-t-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex justify-between items-start">

                    <div>
                        <h2 className="text-white font-semibold text-[15px]">
                            Skills Proficiency Chart
                        </h2>

                        <p className="text-blue-100 text-[11px] -mt-0.5">
                            {subdomain ? `${subdomain} Internship` : "Internship Program"}
                        </p>

                    </div>

                    <button
                        onClick={onClose}
                        className="text-white text-lg px-2 hover:text-gray-200 transition"
                    >
                        ✕
                    </button>
                </div>

                {/* <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="max-w-md mx-auto"
                > */}
                <svg


                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${size} ${size}`}

                    className="w-full h-full"
                >

                    <style>
                        {`
          @keyframes drawPolygon {
            to {
              stroke-dashoffset: 0;
            }
          }
          @keyframes fadeIn {
            to {
              opacity: 1;
            }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 0.4;
            }
            50% {
              opacity: 0.8;
            }
          }
            @keyframes rotateRing {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }


  
}

@keyframes movePulse {
  0% {
    transform: scale(0.3);
    opacity: 0.2;
  }
  70% {
    transform: scale(1);
    opacity: 0.4;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}


        `}
                    </style>

                    {/* Background circles */}
                    {/* Rotating Gray Ring Animation */}
                    <g
                        style={{
                            transformOrigin: `${center}px ${center}px`,
                            animation: "rotateRing 12s linear infinite",
                            opacity: 0.2
                        }}
                    >
                        <circle
                            cx={center}
                            cy={center}
                            r={radius + 10}
                            fill="none"
                            stroke="#9CA3AF"
                            strokeWidth="2"
                            strokeDasharray="10 20"
                        />
                    </g>

                    {[20, 40, 60, 80, 100].map((level, index) => (
                        <circle
                            key={index}
                            cx={center}
                            cy={center}
                            r={(radius * level) / 100}
                            fill="none"
                            stroke="#E5E7EB"
                            strokeWidth="1"
                            opacity="0.6"
                        />
                    ))}

                    {/* Axis lines */}
                    {skills.map((_, index) => {
                        const angle = angleStep * index - Math.PI / 2;
                        const endX = center + radius * Math.cos(angle);
                        const endY = center + radius * Math.sin(angle);
                        const isHighlighted = index === highlightIndex;

                        return (
                            <line
                                key={index}
                                x1={center}
                                y1={center}
                                x2={endX}
                                y2={endY}
                                stroke={isHighlighted ? "#2563EB" : "#9CA3AF"}  // blue • gray

                                strokeWidth={isHighlighted ? "2" : "1"}
                                opacity="0.5"
                            />
                        );
                    })}

                    {/* Skill polygon */}
                    <path
                        d={pathData}
                        fill="rgba(99, 102, 241, 0.2)"
                        stroke="#6366F1"
                        strokeWidth="2.5"
                        style={{
                            animation: "drawPolygon 1s ease-out forwards",
                            strokeDasharray: "1000",
                            strokeDashoffset: "1000"
                        }}
                    />

                    {/* Moving gray pulse toward highlighted point */}
                    {(() => {
                        const p = skillPoints[highlightIndex];
                        return (
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r="14"
                                fill="rgba(156, 163, 175, 0.35)" /* gray-400 */
                                style={{
                                    animation: "movePulse 1.8s ease-out infinite",
                                    transformOrigin: `${p.x}px ${p.y}px`
                                }}
                            />
                        );
                    })()}


                    {/* Skill points */}
                    {skillPoints.map((point, index) => {
                        const isHighlighted = index === highlightIndex;
                        return (
                            <g key={index}>
                                {isHighlighted && (
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r="12"
                                        fill="rgba(99, 102, 241, 0.3)"
                                        style={{ animation: "pulse 2s ease-in-out infinite" }}
                                    />
                                )}
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={isHighlighted ? "6" : "5"}
                                    fill={isHighlighted ? "#2563EB" : "#9CA3AF"}   // blue • gray

                                    stroke="#fff"
                                    strokeWidth="2"
                                    style={{
                                        animation: `fadeIn 0.5s ease-out ${index * 0.1}s forwards`,
                                        opacity: 0
                                    }}
                                />
                            </g>
                        );
                    })}

                    {/* Skill Labels with improved visibility */}
                    {skills.map((skill, index) => {
                        const pos = getLabelPosition(index);
                        const isHighlighted = index === highlightIndex;

                        // Determine text alignment based on position
                        let textAnchor = "middle";
                        const angle = pos.angle * (180 / Math.PI);
                        if (angle > 45 && angle < 135) {
                            textAnchor = "start";
                        } else if (angle > -135 && angle < -45) {
                            textAnchor = "end";
                        }

                        return (
                            <g key={index}>
                                {/* Text background for better visibility */}
                                <rect
                                    x={pos.x - 35}
                                    y={pos.y - 18}
                                    width="110"
                                    height="48"


                                    fill="white"
                                    opacity="0.9"
                                    rx="4"
                                    style={{
                                        animation: `fadeIn 0.5s ease-out ${index * 0.1 + 0.5}s forwards`,
                                        opacity: 0
                                    }}
                                />
                                <text
                                    x={pos.x}
                                    y={pos.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    style={{
                                        fontSize: isHighlighted ? "15px" : "13px",
                                        fontWeight: isHighlighted ? "700" : "600",
                                        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto",

                                        fill: isHighlighted ? "#2563EB" : "#6B7280",  // dark blue / blue-600


                                        animation: `fadeIn 0.5s ease-out ${index * 0.1 + 0.5}s forwards`,
                                        opacity: 0,
                                        pointerEvents: "none"
                                    }}
                                >
                                    {skill.split(" ").map((word, i) => (
                                        <tspan key={i} x={pos.x} dy={i === 0 ? 0 : "1.1em"}>
                                            {word}
                                        </tspan>
                                    ))}
                                </text>
                            </g>
                        );
                    })}

                    {/* Percentage Labels with better styling */}
                    {[20, 40, 60, 80, 100].map((level, index) => (
                        <text
                            key={index}
                            x={center + 8}
                            y={center - (radius * level) / 100 + 4}
                            style={{
                                fontSize: "11px",
                                fill: "#6B7280",
                                fontWeight: "600",
                                animation: `fadeIn 0.5s ease-out ${index * 0.05}s forwards`,
                                opacity: 0
                            }}
                        >
                            {level}%
                        </text>
                    ))}
                </svg>
            </div>
        </div>
    );

};

export default SkillSpiderChartModal;