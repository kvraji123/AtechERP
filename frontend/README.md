# ATECH Automation Frontend - Reviewed Package

## Included
- Dashboard and responsive application layout
- Customer Master list and form
- Part Master list and form
- Marketing enquiry list
- Enquiry, feasibility, workout and quotation screens
- Axios API client and marketing API mappings
- Route configuration and shared components
- Separate page CSS files retained for each master and marketing page

## Run
```bash
npm install
copy .env.example .env
npm run dev
```

## Production build
```bash
npm run build
```

## API
Update `.env`:
```env
VITE_API_BASE_URL=http://localhost:4100/api/v1
VITE_USER_CODE=EM7778
```

## Notes
Customer and Part Master list/form API wiring is partly placeholder-based in the supplied source. Marketing screens are connected through `src/api/marketing.api.ts`.
