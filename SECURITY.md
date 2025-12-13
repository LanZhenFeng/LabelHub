# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

> **Note**: LabelHub is currently in pre-release. Security updates will be provided for the latest version only.

## Reporting a Vulnerability

We take the security of LabelHub seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do NOT Disclose Publicly

**Please do not open a public GitHub issue for security vulnerabilities.**

### 2. Contact Us Privately

Send a detailed report to:

📧 **security@labelhub.example.com** (placeholder - replace with actual email)

Or use GitHub's private vulnerability reporting feature (if enabled).

### 3. Include in Your Report

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information for follow-up

### 4. What to Expect

| Timeline | Action |
|----------|--------|
| 24-48 hours | We will acknowledge receipt of your report |
| 7 days | We will provide an initial assessment |
| 30-90 days | We will work on a fix (depending on severity) |
| After fix | We will publicly disclose with credit to reporter (if desired) |

## Security Best Practices for Users

When deploying LabelHub:

1. **Keep Updated**: Always use the latest version
2. **HTTPS**: Deploy behind HTTPS in production
3. **Authentication**: Enable authentication; use strong passwords
4. **Network**: Restrict network access to trusted users
5. **Data**: Regularly backup your data
6. **Secrets**: Never commit secrets to the repository

## Security Features (Planned)

- [x] JWT-based authentication
- [x] Input validation (Pydantic)
- [ ] Rate limiting (v1.1)
- [ ] Audit logging
- [ ] RBAC (Role-Based Access Control)

---

Thank you for helping keep LabelHub secure! 🔒
