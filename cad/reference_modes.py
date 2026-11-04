"""Independent developer reference: conforming tetrahedral cavity FEM (P1/P2).

CAD boundary geometry is shared; stiffness/mass assembly is independent of the
app's voxel finite-volume operator. Rigid walls, sealed drivers, p=0 mouth only.
Units: CAD input mm, assembled matrices SI. No drivers, losses or fitting.
"""
import json, math, sys, tempfile
from pathlib import Path
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import eigsh
from scipy.sparse.csgraph import connected_components

def element_matrices(points):
    """P1 tetra: K_ij=V grad(Ni).grad(Nj), M=V/20*(1+delta_ij)."""
    b=np.concatenate((np.ones((*points.shape[:-1],1)),points),axis=-1)
    volume=np.abs(np.linalg.det(b))/6
    if np.any(volume<1e-18): raise ValueError('Degenerate tetrahedron')
    gradients=np.linalg.inv(b)[...,1:,:]
    stiffness=volume[:,None,None]*np.einsum('eai,eaj->eij',gradients,gradients)
    mass=volume[:,None,None]/20*(np.ones((4,4))+np.eye(4))
    return stiffness,mass,volume

def quadratic_element_matrices(points):
    """Straight P2 tetrahedra; integrate barycentric polynomials exactly.
    Infer Gmsh's edge-node ordering geometrically instead of assuming a convention.
    """
    _,_,volume=element_matrices(points[:,:4])
    b=np.concatenate((np.ones((len(points),4,1)),points[:,:4]),axis=-1)
    gradients=np.linalg.inv(b)[:,1:,:].transpose(0,2,1)
    pairs=[(i,j) for i in range(4) for j in range(i+1,4)]
    mids=np.array([(points[0,i]+points[0,j])/2 for i,j in pairs])
    edge_order=[pairs[int(np.argmin(np.linalg.norm(mids-pt,axis=1)))] for pt in points[0,4:]]
    if len(set(edge_order))!=6:raise ValueError('Unexpected quadratic tetrahedron ordering')
    # Verify each element uses the same ordering and is geometrically straight.
    for node,(i,j) in enumerate(edge_order,4):
        if np.max(np.abs(points[:,node]-(points[:,i]+points[:,j])/2))>1e-8:raise ValueError('Reference P2 elements must be straight')
    polys=[];W=np.zeros((len(points),10,4,3))
    for i in range(4):
        one=tuple(1 if a==i else 0 for a in range(4));two=tuple(2 if a==i else 0 for a in range(4));polys.append({two:2.,one:-1.})
        W[:,i,:,:]=-gradients[:,i,None,:];W[:,i,i,:]+=4*gradients[:,i,:]
    for node,(i,j) in enumerate(edge_order,4):
        exponent=tuple(int(a==i)+int(a==j) for a in range(4));polys.append({exponent:4.})
        W[:,node,i,:]=4*gradients[:,j,:];W[:,node,j,:]=4*gradients[:,i,:]
    mass=np.zeros((10,10))
    for i in range(10):
        for j in range(10):
            for a,ca in polys[i].items():
                for b,cb in polys[j].items():
                    ex=[a[k]+b[k] for k in range(4)]
                    mass[i,j]+=ca*cb*6*math.prod(math.factorial(e) for e in ex)/math.factorial(sum(ex)+3)
    summed=W.sum(axis=2)
    stiffness=volume[:,None,None]/20*(np.einsum('eid,ejd->eij',summed,summed)+np.einsum('eiad,ejad->eij',W,W))
    return stiffness,volume[:,None,None]*mass,volume

def air_shape(data):
    import cadquery as cq
    lo=np.array(data['bounds'][0]);hi=np.array(data['bounds'][1]);size=hi-lo
    air=cq.Workplane('XY').box(*size).translate(tuple((lo+hi)/2))
    for p in data.get('panels',[]):
        if p.get('footprint'):
            f=p['footprint'];part=cq.Workplane('XY').polyline(f['polygon']).close().extrude(f['depth']).translate((0,0,f['z']))
        else:
            part=cq.Workplane('XY').box(p['width'],p['height'],p['thickness'])
            # Driver holes intentionally sealed. Rectangular mouth already split
            # into exact stock pieces by the exported wallPieces geometry.
            for axis,angle in zip([(1,0,0),(0,1,0),(0,0,1)],p['rotation']):
                if angle: part=part.rotate((0,0,0),axis,math.degrees(angle))
            part=part.translate(tuple(p['position']))
        air=air.cut(part)
    solids=air.solids().vals()
    if len(solids)!=1 or not solids[0].isValid():raise ValueError('Reference cavity must be one valid connected CAD solid')
    return solids[0]

def solve(data):
    import gmsh
    h=float(data['cellMm']);count=int(data.get('count',8));order=int(data.get('order',2))
    if order not in (1,2):raise ValueError('Reference order must be1or2')
    if not 8<=h<=150 or not 1<=count<=16:raise ValueError('Reference mesh/count outside budget')
    max_nodes=int(data.get('maxNodes',30000))
    if not 500<=max_nodes<=80000:raise ValueError('Reference node budget outside500–80000')
    shape=air_shape(data)
    with tempfile.TemporaryDirectory(prefix='aegir-reference-') as tmp:
        brep=str(Path(tmp)/'cavity.brep');shape.exportBrep(brep)
        gmsh.initialize();gmsh.option.setNumber('General.Terminal',0)
        try:
            gmsh.model.add('unloaded-cavity');gmsh.model.occ.importShapes(brep);gmsh.model.occ.synchronize()
            gmsh.option.setNumber('Mesh.MeshSizeMin',h);gmsh.option.setNumber('Mesh.MeshSizeMax',h)
            refined_edges=[]
            if data.get('edgeRefine'):
                # Resolve internal board tips/contacts generically, without using
                # any target frequency. Exclude edges lying on exterior planes.
                lo,hi=np.asarray(data['bounds'][0]),np.asarray(data['bounds'][1])
                for _,curve in gmsh.model.getEntities(1):
                    box=np.array(gmsh.model.getBoundingBox(1,curve));axis=int(np.argmax(box[3:]-box[:3]));other=[a for a in range(3) if a!=axis]
                    if all(box[a]>lo[a]+1e-4 and box[a+3]<hi[a]-1e-4 for a in other):refined_edges.append(curve)
                if refined_edges:
                    gmsh.option.setNumber('Mesh.MeshSizeMin',h/10)
                    distance=gmsh.model.mesh.field.add('Distance');gmsh.model.mesh.field.setNumbers(distance,'CurvesList',refined_edges);gmsh.model.mesh.field.setNumber(distance,'Sampling',200)
                    threshold=gmsh.model.mesh.field.add('Threshold');gmsh.model.mesh.field.setNumber(threshold,'InField',distance)
                    for key,value in [('SizeMin',h/10),('SizeMax',h),('DistMin',h/4),('DistMax',h)]:gmsh.model.mesh.field.setNumber(threshold,key,value)
                    gmsh.model.mesh.field.setAsBackgroundMesh(threshold)
            gmsh.option.setNumber('Mesh.ElementOrder',1);gmsh.option.setNumber('General.NumThreads',1)
            gmsh.option.setNumber('Mesh.RandomSeed',1)
            gmsh.model.mesh.generate(3)
            if order==2:
                gmsh.option.setNumber('Mesh.SecondOrderLinear',1);gmsh.model.mesh.setOrder(2)
            tags,coords,_=gmsh.model.mesh.getNodes();coords=np.asarray(coords).reshape(-1,3)*1e-3
            if len(tags)>max_nodes:raise ValueError(f'Reference FEM exceeds{max_nodes}nodes; use coarser mesh or explicitly select a larger offline budget')
            lookup={int(t):i for i,t in enumerate(tags)}
            _,tet_nodes=gmsh.model.mesh.getElementsByType(4 if order==1 else 11)
            width=4 if order==1 else 10
            tets=np.array([lookup[int(t)] for t in tet_nodes]).reshape(-1,width)
            axis=int(data['mouthAxis']);plane=float(data['mouthPlaneMm']);fixed=set();mouth_area=0.
            for _,surface in gmsh.model.getEntities(2):
                box=gmsh.model.getBoundingBox(2,surface)
                if abs(box[axis]-plane)>1e-4 or abs(box[axis+3]-plane)>1e-4:continue
                nodes,_,_=gmsh.model.mesh.getNodes(2,surface,True)
                fixed.update(lookup[int(t)] for t in nodes)
                mouth_area+=gmsh.model.occ.getMass(2,surface)
            if not fixed:raise ValueError('No pressure-release mouth face found')
        finally:gmsh.finalize()
    k,m,volumes=(element_matrices if order==1 else quadratic_element_matrices)(coords[tets]);n=len(coords)
    rows=np.repeat(tets,width,axis=1).ravel();cols=np.tile(tets,(1,width)).ravel()
    K=coo_matrix((k.ravel(),(rows,cols)),shape=(n,n)).tocsc()
    M=coo_matrix((m.ravel(),(rows,cols)),shape=(n,n)).tocsc()
    if connected_components(M,directed=False)[0]!=1:raise ValueError('Disconnected FEM graph')
    free=np.array([i for i in range(n) if i not in fixed]);K=K[free][:,free];M=M[free][:,free]
    values,vectors=eigsh(K,M=M,k=min(count,len(free)-2),sigma=0,which='LM',tol=1e-9,v0=np.random.default_rng(0).standard_normal(len(free)))
    order=np.argsort(values);values=values[order];vectors=vectors[:,order]
    residuals=[float(np.linalg.norm(K@vectors[:,i]-values[i]*(M@vectors[:,i]))/max(np.linalg.norm(K@vectors[:,i]),1e-30)) for i in range(len(values))]
    if min(values)<=0:raise ValueError('Invalid reference eigenvalues')
    return dict(frequenciesHz=(float(data['c'])/(2*np.pi)*np.sqrt(values)).tolist(),relativeResiduals=residuals,meta=dict(cellMm=h,edgeRefinement=bool(data.get('edgeRefine')),refinedEdges=len(refined_edges),cells=len(tets),nodes=n,cavityLitres=float(volumes.sum()*1000),cadCavityLitres=shape.Volume()*1e-6,mouthAreaMm2=mouth_area,method=f'Independent conforming tetrahedral P{order} FEM; exactly integrated consistent mass/stiffness',boundary='Rigid walls and sealed drivers; pressure-zero physical mouth plane'))

if __name__=='__main__':
    try:print(json.dumps(solve(json.load(sys.stdin))))
    except Exception as error:print(str(error),file=sys.stderr);sys.exit(1)
