import React, { useState, useEffect } from 'react';
import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  QueryClient, 
  QueryClientProvider 
} from '@tanstack/react-query';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Calculator, 
  RefreshCw, 
  BookOpen, 
  AlertTriangle, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  Box, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Globe,
  Tag
} from 'lucide-react';

// Simple custom Toast implementation following Shadcn/Sonner design paradigms
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toastState: Toast[] = [];

const toast = {
  custom: (type: Toast['type'], title: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, type, title, description };
    toastState = [newToast, ...toastState].slice(0, 5);
    toastListeners.forEach(listener => listener([...toastState]));
    setTimeout(() => {
      toast.dismiss(id);
    }, 4500);
  },
  success: (title: string, description?: string) => toast.custom('success', title, description),
  error: (title: string, description?: string) => toast.custom('error', title, description),
  warning: (title: string, description?: string) => toast.custom('warning', title, description),
  info: (title: string, description?: string) => toast.custom('info', title, description),
  dismiss: (id: string) => {
    toastState = toastState.filter(t => t.id !== id);
    toastListeners.forEach(listener => listener([...toastState]));
  }
};

const Toaster = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastListeners.push(setToasts);
    return () => {
      toastListeners = toastListeners.filter(l => l !== setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map(t => {
        const bgMap = {
          success: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200',
          error: 'bg-rose-950/90 border-rose-500/40 text-rose-200',
          warning: 'bg-amber-950/90 border-amber-500/40 text-amber-200',
          info: 'bg-slate-900/90 border-slate-700 text-slate-200'
        };

        const iconMap = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          info: <AlertCircle className="w-5 h-5 text-sky-400 shrink-0" />
        };

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5 ${bgMap[t.type]}`}
          >
            {iconMap[t.type]}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold leading-tight">{t.title}</h4>
              {t.description && (
                <p className="text-xs opacity-80 mt-1 leading-normal break-words">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-slate-400 hover:text-slate-100 rounded-lg p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

const API_BASE_URL = 'http://localhost:8000';

export interface Book {
  id: number;
  isbn: string;
  author: string;
  category: string;
  supplier_country: string;
  cost_usd: number;
  stock_quantity: number;
  selling_price?: number | string | null;
}

export interface BookPayload {
  isbn: string;
  author: string;
  category: string;
  supplier_country: string;
  cost_usd: number;
  stock_quantity: number;
}

export interface PriceCalculation {
  book_id: number;
  cost_usd: number;
  exchange_rate: number;
  cost_local: number;
  margin: number;
  final_local_selling_price: number;
  currency_code: string;
  timestamp?: string;
}

// Helper API Fetcher with central error handling and toast triggers
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
  } catch (err: any) {
    const errorMsg = 'Could not connect to http://localhost:8000. Please make sure the backend API server is running.';
    toast.error('Network Connection Error', errorMsg);
    throw new Error(errorMsg);
  }

  if (!response.ok) {
    let detail = 'An error occurred while processing your request.';
    try {
      const errorData = await response.json();
      detail = errorData.detail || errorData.message || JSON.stringify(errorData);
    } catch {
      detail = `HTTP ${response.status}: ${response.statusText}`;
    }

    if (response.status === 409) {
      toast.error('Conflict Error (409)', detail || 'A record with this identifier already exists.');
    } else if (response.status === 404) {
      toast.error('Not Found (404)', detail || 'The requested resource was not found.');
    } else if (response.status === 400) {
      toast.error('Bad Request (400)', detail || 'Invalid parameters supplied.');
    } else {
      toast.error(`Error (${response.status})`, detail);
    }

    throw new Error(detail);
  }

  // Handle empty bodies (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function BookInventoryApp() {
  // Query Filters & Pagination State
  const [categoryFilter, setCategoryFilter] = useState('');
  const [thresholdFilter, setThresholdFilter] = useState<number | ''>('');
  const [limit, setLimit] = useState<number>(5);
  const [page, setPage] = useState<number>(1);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null);
  const [priceCalcData, setPriceCalcData] = useState<PriceCalculation | null>(null);
  const [isCalcLoading, setIsCalcLoading] = useState(false);

  const offset = (page - 1) * limit;

  // Fetch Books Query
  const { 
    data: books = [], 
    isLoading, 
    isFetching, 
    refetch 
  } = useQuery<Book[]>({
    queryKey: ['books', thresholdFilter, categoryFilter, limit, offset],
    queryFn: () => {
      const params = new URLSearchParams();
      if (thresholdFilter !== '' && thresholdFilter !== undefined) {
        params.append('threshold', thresholdFilter.toString());
      }
      if (categoryFilter.trim()) {
        params.append('category', categoryFilter.trim());
      }
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      return apiFetch<Book[]>(`/books?${params.toString()}`);
    },
  });

  // Create Book Mutation
  const createBookMutation = useMutation({
    mutationFn: (newBook: BookPayload) => apiFetch<Book>('/books/', {
      method: 'POST',
      body: JSON.stringify(newBook),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book Created', 'The book was added to the inventory successfully.');
      setIsAddOpen(false);
    },
  });

  // Update Book Mutation
  const updateBookMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BookPayload }) => 
      apiFetch<Book>(`/books/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book Updated', 'The book information has been saved.');
      setEditingBook(null);
    },
  });

  // Delete Book Mutation
  const deleteBookMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/books/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success('Book Deleted', 'The book has been removed from inventory.');
      setDeletingBookId(null);
    },
  });

  // Calculate Price Handler
  const handleCalculatePrice = async (bookId: number) => {
    setIsCalcLoading(true);
    try {
      const data = await apiFetch<PriceCalculation>(`/books/${bookId}/calculate-price`);
      setPriceCalcData(data);
      toast.success('Price Calculated', `Selling price calculated: ${data.selling_price} ${data.currency_code}`);
    } catch {
      // Error is caught and toasted in apiFetch
    } finally {
      setIsCalcLoading(false);
    }
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setThresholdFilter('');
      setPage(1);
      return;
    }
    const num = parseInt(val, 10);
    if (num < 0) {
      toast.warning('Invalid Stock Threshold', 'Stock threshold cannot be negative.');
      setThresholdFilter(0);
    } else {
      setThresholdFilter(num);
    }
    setPage(1);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCategoryFilter(e.target.value);
    setPage(1);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      <Toaster />

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400 shadow-inner">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Book Inventory Manager
              </h1>
              <p className="text-xs text-slate-400">Local Service API Sync (`http://localhost:8000`)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white transition-all text-slate-300 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Book</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">

        {/* Filters & Controls Toolbar */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Left side filters */}
            <div className="flex flex-wrap items-center gap-4 flex-1">
              {/* Category Filter */}
              <div className="flex flex-col gap-1 min-w-[200px] flex-1 sm:flex-initial">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  Category
                </label>
                <input
                  type="text"
                  placeholder="Filter by category..."
                  value={categoryFilter}
                  onChange={handleCategoryChange}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Threshold Filter with Strict Non-Negative Constraint */}
              <div className="flex flex-col gap-1 min-w-[180px] flex-1 sm:flex-initial">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-indigo-400" />
                  Stock Threshold (Min 0)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 10"
                  value={thresholdFilter}
                  onChange={handleThresholdChange}
                  onKeyDown={(e) => {
                    if (e.key === '-') e.preventDefault(); // Block negative typing
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Reset Filters Quick Button */}
              {(categoryFilter || thresholdFilter !== '') && (
                <button
                  onClick={() => {
                    setCategoryFilter('');
                    setThresholdFilter('');
                    setPage(1);
                  }}
                  className="self-end mb-0.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Right side page limit selector */}
            <div className="flex items-center gap-3 self-end lg:self-center border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0 w-full lg:w-auto justify-between lg:justify-start">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                Per Page:
              </label>
              <select
                value={limit}
                onChange={handleLimitChange}
                className="px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 cursor-pointer"
              >
                <option value={5}>5 books</option>
                <option value={10}>10 books</option>
                <option value={20}>20 books</option>
                <option value={50}>50 books</option>
              </select>
            </div>

          </div>
        </div>

        {}
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Loading books from server...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && books.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30 text-center px-4">
            <div className="p-4 bg-slate-900 rounded-full text-slate-500 mb-4 border border-slate-800">
              <BookOpen className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200">No Books Found</h3>
            <p className="text-sm text-slate-400 max-w-md mt-1 mb-6">
              There are no books matching your current filters or available in the inventory database.
            </p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
            >
              <Plus className="w-4 h-4" />
              Add First Book
            </button>
          </div>
        )}

        {/* Book Grid using Flexbox layout flex flex-wrap gap-6 justify-start */}
        {!isLoading && books.length > 0 && (
          <div className="flex flex-wrap gap-6 justify-start">
            {books.map((book) => {
              // Stock alert checking (threshold or default <= 5)
              const threshold = typeof thresholdFilter === 'number' ? thresholdFilter : 5;
              const isLowStock = book.stock_quantity <= threshold;

              return (
                <div
                  key={book.id}
                  className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)] min-w-[280px] bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg transition-all duration-200 hover:shadow-2xl hover:-translate-y-0.5 group"
                >
                  <div className="space-y-4">
                    {/* Header ID & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        ID: #{book.id}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 truncate max-w-[130px]">
                        {book.category}
                      </span>
                    </div>

                    {/* Book Details */}
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1" title={book.author}>
                        {book.author}
                      </h3>
                      <p className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-1">
                        <span className="text-slate-500">ISBN:</span> {book.isbn}
                      </p>
                    </div>

                    {/* Meta stats */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        <span className="uppercase font-semibold">{book.supplier_country}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-300 justify-end">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-semibold">{book.cost_usd.toFixed(2)} USD</span>
                      </div>
                    </div>

                    {/* Stock Quantity Badge */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-400">Stock Quantity:</span>
                      {isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          {book.stock_quantity} (Low)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <Box className="w-3 h-3" />
                          {book.stock_quantity} in stock
                        </span>
                      )}
                    </div>

                    {/* Selling price preview if present */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Local Selling Price:</span>
                      <span className="font-medium text-slate-200">
                        {book.selling_price_local ? `${book.selling_price_local}` : <span className="text-slate-500 italic">Not calculated</span>}
                      </span>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleCalculatePrice(book.id)}
                      disabled={isCalcLoading}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-slate-700/60 transition-colors"
                      title="Calculate Local Selling Price"
                    >
                      <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Calc Price</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingBook(book)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
                        title="Edit Book"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setDeletingBookId(book.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-colors"
                        title="Delete Book"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {}
        {!isLoading && books.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-sm text-slate-400">
            <div>
              Showing <span className="font-semibold text-slate-200">{offset + 1}</span> to{' '}
              <span className="font-semibold text-slate-200">{offset + books.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs">
                Page {page}
              </span>

              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={books.length < limit}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </main>

      {}
      {(isAddOpen || editingBook) && (
        <BookFormModal
          isOpen={isAddOpen || !!editingBook}
          editingBook={editingBook}
          onClose={() => {
            setIsAddOpen(false);
            setEditingBook(null);
          }}
          onSubmit={(payload) => {
            if (editingBook) {
              updateBookMutation.mutate({ id: editingBook.id, payload });
            } else {
              createBookMutation.mutate(payload);
            }
          }}
          isSubmitting={createBookMutation.isPending || updateBookMutation.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingBookId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-950/60 border border-rose-900/50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Delete Book</h3>
            </div>
            <p className="text-sm text-slate-300">
              Are you sure you want to delete book <span className="font-mono text-rose-300">#{deletingBookId}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingBookId(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteBookMutation.mutate(deletingBookId)}
                disabled={deleteBookMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                {deleteBookMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Calculation Breakdown Modal */}
      {priceCalcData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-indigo-400">
                <Calculator className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Price Calculation Breakdown</h3>
              </div>
              <button
                onClick={() => setPriceCalcData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Book ID:</span>
                <span className="font-mono text-slate-200">#{priceCalcData.book_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Base Cost (USD):</span>
                <span className="font-semibold text-slate-200">${priceCalcData.cost_usd}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Exchange Rate:</span>
                <span className="font-mono text-slate-200">{priceCalcData.exchange_rate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Cost Local:</span>
                <span className="text-slate-200">{priceCalcData.cost_local} {priceCalcData.currency_code}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Margin Applied:</span>
                <span className="text-indigo-400 font-semibold">{((priceCalcData.margin || 0.4) * 100).toFixed(0)}%</span>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex justify-between items-center">
                <span className="font-medium text-slate-200">Final Selling Price:</span>
                <span className="text-lg font-bold text-indigo-300">
                  {priceCalcData.selling_price_local} {priceCalcData.currency_code}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setPriceCalcData(null)}
                className="w-full py-2.5 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

interface BookFormModalProps {
  isOpen: boolean;
  editingBook: Book | null;
  onClose: () => void;
  onSubmit: (payload: BookPayload) => void;
  isSubmitting: boolean;
}

function BookFormModal({ editingBook, onClose, onSubmit, isSubmitting }: BookFormModalProps) {
  const [isbn, setIsbn] = useState(editingBook?.isbn || '');
  const [author, setAuthor] = useState(editingBook?.author || '');
  const [category, setCategory] = useState(editingBook?.category || '');
  const [supplierCountry, setSupplierCountry] = useState(editingBook?.supplier_country || '');
  const [costUsd, setCostUsd] = useState<number | ''>(editingBook?.cost_usd ?? '');
  const [stockQuantity, setStockQuantity] = useState<number | ''>(editingBook?.stock_quantity ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isbn.trim() || !author.trim() || !category.trim() || !supplierCountry.trim()) {
      toast.warning('Validation Error', 'Please fill in all required fields.');
      return;
    }

    if (supplierCountry.trim().length < 2 || supplierCountry.trim().length > 3) {
      toast.warning('Validation Error', 'Supplier Country code must be 2 or 3 characters (e.g. US, DE, GBR).');
      return;
    }

    const numCost = Number(costUsd);
    if (isNaN(numCost) || numCost < 0) {
      toast.warning('Validation Error', 'Cost USD must be a valid non-negative number.');
      return;
    }

    const numStock = Number(stockQuantity);
    if (isNaN(numStock) || numStock < 0) {
      toast.warning('Validation Error', 'Stock quantity cannot be negative (must be >= 0).');
      return;
    }

    onSubmit({
      isbn: isbn.trim(),
      author: author.trim(),
      category: category.trim(),
      supplier_country: supplierCountry.trim().toUpperCase(),
      cost_usd: numCost,
      stock_quantity: numStock,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            {editingBook ? <Edit3 className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
            {editingBook ? 'Edit Book Record' : 'Add New Book'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">ISBN</label>
              <input
                type="text"
                required
                placeholder="e.g. 978-3-16-148410-0"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Author</label>
              <input
                type="text"
                required
                placeholder="Author name"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Category</label>
              <input
                type="text"
                required
                placeholder="e.g. Fiction, Tech"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Supplier Country (2-3 chars)
              </label>
              <input
                type="text"
                maxLength={3}
                required
                placeholder="e.g. US, DE, GBR"
                value={supplierCountry}
                onChange={(e) => setSupplierCountry(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Cost (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={costUsd}
                onChange={(e) => setCostUsd(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Stock Quantity (Min 0)
              </label>
              <input
                type="number"
                min="0"
                required
                placeholder="0"
                value={stockQuantity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setStockQuantity('');
                  } else {
                    const num = parseInt(val, 10);
                    if (num < 0) {
                      toast.warning('Invalid Stock Quantity', 'Stock quantity cannot be negative.');
                      setStockQuantity(0);
                    } else {
                      setStockQuantity(num);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === '-') e.preventDefault();
                }}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingBook ? 'Update Book' : 'Create Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BookInventoryApp />
    </QueryClientProvider>
  );
}
