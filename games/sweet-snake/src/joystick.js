// Four-way deadzone and angular hysteresis from sweet_snake_joystick.html.
function resolveJoystick(dx, dy, radius, previous) {
  const distance=Math.hypot(dx,dy), force=Math.min(1,distance/radius);
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  const threshold=previous ? 0.22 : 0.32;
  let direction='';
  if(force>=threshold) {
    if(previous==='right' && angle>=-55 && angle<=55) direction='right';
    else if(previous==='down' && angle>=35 && angle<=145) direction='down';
    else if(previous==='up' && angle>=-145 && angle<=-35) direction='up';
    else if(previous==='left' && (angle>=125 || angle<=-125)) direction='left';
    else direction=angle>=-45 && angle<45?'right':angle>=45 && angle<135?'down':angle>=-135 && angle<-45?'up':'left';
  }
  const scale=distance>radius?radius/distance:1;
  return {direction,x:Math.round(dx*scale*10)/10,y:Math.round(dy*scale*10)/10,
    angle:Math.round(angle+90),opacity:force>=.15?Math.min(1,force*1.1):0};
}
export { resolveJoystick };
