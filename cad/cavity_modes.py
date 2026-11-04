"""Unloaded cavity eigenmodes from ÆGIR's symmetric finite-volume graph (SI).
Read JSON from stdin. Requires numpy/scipy; no commercial solver.
"""
import sys,json,math
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import eigsh
from scipy.sparse.csgraph import connected_components

def solve(data,count=12):
    diagonal=np.asarray(data['diagonal']);n=len(diagonal)
    if n<4 or n>180000:raise ValueError('Modal matrix size outside budget.')
    rows=list(range(n));cols=list(range(n));values=list(diagonal)
    for a,b,w in data['edges']:
        rows.extend([a,b]);cols.extend([b,a]);values.extend([-w,-w])
    matrix=coo_matrix((values,(rows,cols)),shape=(n,n)).tocsc()
    components,_=connected_components(matrix,directed=False)
    if components!=1:raise ValueError(f'Cavity has{components} disconnected air components. Check seals/passages and mesh; disconnected modes are not silently removed.')
    k=min(count,n-2)
    eigenvalues,vectors=eigsh(matrix,k=k,sigma=0,which='LM',tol=1e-9,v0=np.random.default_rng(0).standard_normal(n))
    order=np.argsort(eigenvalues);eigenvalues=eigenvalues[order];vectors=vectors[:,order]
    residuals=[float(np.linalg.norm(matrix@vectors[:,i]-eigenvalues[i]*vectors[:,i])/max(abs(eigenvalues[i]),1)) for i in range(k)]
    if min(eigenvalues)<=0:raise ValueError('Non-positive cavity eigenvalue; pressure-release boundary/connectivity is invalid.')
    return dict(meta=data['meta'],frequenciesHz=[float(data['c']*math.sqrt(x)/(2*math.pi)) for x in eigenvalues],relativeResiduals=residuals)

if __name__=='__main__':
    try:
        request=json.load(sys.stdin);print(json.dumps(solve(request,request.get('count',12))))
    except Exception as error:
        print(str(error),file=sys.stderr);sys.exit(1)
