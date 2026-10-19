use std::{fs, io::{Read, Write}, net::{TcpListener, TcpStream}, path::{Component, Path, PathBuf}, process::Command, time::Duration};

fn decoded_path(path: &str) -> Option<String> {
    let bytes = path.as_bytes(); let mut decoded = Vec::new(); let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' { if i+2 >= bytes.len() { return None; } let text = std::str::from_utf8(&bytes[i+1..i+3]).ok()?; decoded.push(u8::from_str_radix(text,16).ok()?); i+=3; }
        else { decoded.push(bytes[i]); i+=1; }
    }
    String::from_utf8(decoded).ok()
}
fn resolve(root: &Path, request_path: &str) -> Option<PathBuf> {
    let decoded = decoded_path(request_path.split('?').next()?)?;
    if decoded.contains(['\\', ':', '\0']) || !decoded.starts_with('/') { return None; }
    let relative = if decoded == "/" { "index.html" } else { decoded.trim_start_matches('/') };
    let path = Path::new(relative);
    if path.components().any(|c| !matches!(c, Component::Normal(_))) { return None; }
    let candidate = root.join(path).canonicalize().ok()?;
    (candidate.starts_with(root) && candidate.is_file()).then_some(candidate)
}
fn mime(path: &Path) -> &'static str {
    match path.extension().and_then(|s|s.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8", "js" => "text/javascript; charset=utf-8", "css" => "text/css; charset=utf-8",
        "json" => "application/json", "svg" => "image/svg+xml", "png" => "image/png", "woff2" => "font/woff2", _ => "application/octet-stream",
    }
}
fn response(stream: &mut TcpStream, status: &str, content_type: &str, body: &[u8], head: bool) -> std::io::Result<()> {
    write!(stream, "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\nCache-Control: no-cache\r\n\r\n",body.len())?;
    if !head { stream.write_all(body)?; } Ok(())
}
fn handle(mut stream: TcpStream, root: &Path) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));
    let mut request = Vec::new(); let mut buffer = [0u8; 1024];
    while request.len() < 16384 && !request.windows(4).any(|w|w==b"\r\n\r\n") {
        match stream.read(&mut buffer) { Ok(0)|Err(_) => return, Ok(n) => request.extend_from_slice(&buffer[..n]) }
    }
    let Some(line) = std::str::from_utf8(&request).ok().and_then(|s|s.lines().next()) else { return; };
    let mut parts = line.split_whitespace(); let method = parts.next().unwrap_or(""); let path = parts.next().unwrap_or("");
    let head = method == "HEAD";
    if method != "GET" && !head { let _ = response(&mut stream,"405 Method Not Allowed","text/plain",b"Read-only local app",false); return; }
    match resolve(root,path).and_then(|p| fs::read(&p).ok().map(|data|(p,data))) {
        Some((p,data)) => { let _ = response(&mut stream,"200 OK",mime(&p),&data,head); }
        None => { let _ = response(&mut stream,"404 Not Found","text/plain",b"File not found in the P+ Dojo package",head); }
    }
}
fn main() -> std::io::Result<()> {
    let executable = std::env::current_exe()?;
    let args: Vec<_> = std::env::args().collect();
    let root = if let Some(position) = args.iter().position(|a| a == "--root") {
        PathBuf::from(args.get(position+1).ok_or_else(|| std::io::Error::other("--root needs a folder"))?)
    } else { executable.parent().unwrap().join("app") }.canonicalize()?;
    if !root.join("index.html").is_file() { return Err(std::io::Error::other("App files missing. Extract the whole ZIP before running P+ Dojo.")); }
    let listener = TcpListener::bind(("127.0.0.1",0))?;
    let url = format!("http://{}/",listener.local_addr()?);
    println!("P+ Dojo is running at {url}\nAll files are served from this PC. Close this window to stop.\n");
    if !args.iter().any(|a|a=="--no-browser") {
        #[cfg(target_os="windows")] { let _ = Command::new("rundll32.exe").args(["url.dll,FileProtocolHandler",&url]).spawn(); }
        #[cfg(target_os="macos")] { let _ = Command::new("open").arg(&url).spawn(); }
        #[cfg(all(unix,not(target_os="macos")))] { let _ = Command::new("xdg-open").arg(&url).spawn(); }
    }
    for stream in listener.incoming().flatten() { let root = root.clone(); std::thread::spawn(move ||handle(stream,&root)); }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn percent_decoding() { assert_eq!(decoded_path("/hello%20world"),Some("/hello world".into())); assert!(decoded_path("/%GG").is_none()); }
    #[test] fn traversal_is_rejected() {
        let root = std::env::temp_dir().join(format!("dojo-launcher-{}",std::process::id())); fs::create_dir_all(&root).unwrap(); fs::write(root.join("index.html"),b"ok").unwrap(); let root = root.canonicalize().unwrap();
        for path in ["/../secret","/%2e%2e/secret","/%5csecret","/C:/secret","/%00"] { assert!(resolve(&root,path).is_none()); }
        assert!(resolve(&root,"/?frame=3").is_some()); fs::remove_file(root.join("index.html")).unwrap(); fs::remove_dir(root).unwrap();
    }
}
